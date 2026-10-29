import { prisma } from "@/lib/prisma";

/**
 * A SENT quote past its expiry date is closed, whether or not anything has flipped
 * its stored status yet. Every reader of a quote status should go through here so
 * the UI and the actions can't disagree about whether a quote is still open.
 */
export function isQuoteLapsed(q: { status: string; expiresAt: Date | string | null }, now = new Date()): boolean {
  return q.status === "SENT" && q.expiresAt != null && new Date(q.expiresAt) <= now;
}

export function effectiveQuoteStatus<S extends string>(q: { status: S; expiresAt: Date | string | null }): S | "EXPIRED" {
  return isQuoteLapsed(q) ? "EXPIRED" : q.status;
}

/** Prisma `where` fragment: matches only quotes whose expiry hasn't passed. */
export function notLapsedWhere(now = new Date()) {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/**
 * Persist EXPIRED for lapsed quotes. Pass a where-scope (one quote, one store) for
 * the lazy sweeps on read; the daily cron passes none to sweep everything.
 * Conditional on SENT, so it can't clobber an acceptance or decline.
 */
export async function expireLapsedQuotes(scope: { id?: string; storeId?: string } = {}): Promise<number> {
  const now = new Date();
  const result = await prisma.quote.updateMany({
    where: { ...scope, status: "SENT", expiresAt: { lte: now } },
    data: { status: "EXPIRED", respondedAt: now },
  });
  return result.count;
}
