import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

/**
 * Plan-upgrade payment references: SUBUP-{storeId}-{planToken}-{random}.
 *
 * Gateways cap the reference at 50 characters (Korapay rejects longer ones),
 * and two full 25-char cuids plus the prefix and a random suffix is ~66. So
 * the plan is carried as the LAST 8 chars of its id (a cuid's tail is the
 * random part) and resolved back to the full id with resolveSubscriptionId().
 * Max length: 6 + 25 + 1 + 8 + 1 + 6 = 47.
 */
const PLAN_TOKEN_LEN = 8;

export function buildSubscriptionReference(storeId: string, planId: string) {
  return `SUBUP-${storeId}-${planId.slice(-PLAN_TOKEN_LEN)}-${nanoid(6)}`;
}

/** Accepts the short token from a reference (or a full legacy id) and returns the full plan id. */
export async function resolveSubscriptionId(token: string | undefined): Promise<string | undefined> {
  if (!token) return undefined;
  const plan = await prisma.subscription.findFirst({
    where: token.length > PLAN_TOKEN_LEN ? { id: token } : { id: { endsWith: token } },
    select: { id: true },
  });
  return plan?.id;
}
