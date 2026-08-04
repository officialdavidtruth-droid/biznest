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
  const now = new Date();

  const existing = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!existing || existing.resetAt < now) {
    // Window expired or first time — start a fresh window.
    await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return { allowed: true };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  await prisma.rateLimitEntry.update({ where: { key }, data: { count: { increment: 1 } } });
  return { allowed: true };
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
