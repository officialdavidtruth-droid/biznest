import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiter backed by Postgres. Not as precise as a
 * sliding-window Redis limiter, but for tens of requests/minute at this
 * scale it's more than sufficient and needs zero extra infrastructure.
 *
 * @param key unique bucket, e.g. `register:${ip}` or `login:${email}`
 * @param max max allowed actions within the window
 * @param windowMs window length in milliseconds
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (max <= 0 || windowMs <= 0) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };

  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  let existing = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!existing) {
    // Avoid the classic first-request race: two concurrent requests can both
    // observe no row. The unique primary key guarantees only one create wins;
    // the loser re-reads the row and continues through the atomic path below.
    try {
      await prisma.rateLimitEntry.create({
        data: { key, count: 1, resetAt: nextResetAt },
      });
      return { allowed: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      existing = await prisma.rateLimitEntry.findUnique({ where: { key } });
      if (!existing) throw error;
    }
  }

  if (existing.resetAt <= now) {
    // Reset only if this request still owns the expired window. This is an
    // atomic compare-and-set, so concurrent requests cannot both reset the
    // same bucket and receive a fresh allowance.
    const reset = await prisma.rateLimitEntry.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 1, resetAt: nextResetAt },
    });
    if (reset.count === 1) return { allowed: true };
    existing = await prisma.rateLimitEntry.findUnique({ where: { key } });
    if (!existing) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)),
    };
  }

  // Atomic conditional update: concurrent requests cannot all observe the
  // same count and increment past the configured limit. PostgreSQL locks the
  // row for the update and re-checks the predicate before applying it.
  const updated = await prisma.rateLimitEntry.updateMany({
    where: { key, resetAt: { gt: now }, count: { lt: max } },
    data: { count: { increment: 1 } },
  });

  if (updated.count === 1) return { allowed: true };

  const current = await prisma.rateLimitEntry.findUnique({ where: { key } });
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(((current?.resetAt ?? nextResetAt).getTime() - now.getTime()) / 1000)),
  };
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
