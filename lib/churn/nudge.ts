import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { CHURN_COPY } from "@/lib/churn/copy";
import type { ChurnKind } from "@/lib/churn/signals";

/** How often a store with no orders or no logins is reminded again, until it picks up. */
export const RENUDGE_DAYS = 10;
/** Signals worth repeating. A failed payment gets its one clear warning; the rest keep coming until things move. */
export const REPEATING_KINDS: ChurnKind[] = ["NO_ORDERS", "NO_LOGIN"];

/**
 * Tells the owner: a bell notification, a phone push, and the dashboard card/pop-up (a nudge un-hides a card
 * they dismissed earlier). Stamps notifiedAt so the daily job knows when to remind again.
 */
export async function nudgeOwner(input: { userId: string; storeId: string; slug: string; kind: ChurnKind; now?: Date }) {
  const now = input.now ?? new Date();
  const copy = CHURN_COPY[input.kind];
  await notifyUser({ userId: input.userId, type: "CHURN_TIP", title: copy.title, body: copy.body, url: copy.href(input.slug) });
  await prisma.churnSignal.updateMany({
    where: { storeId: input.storeId, kind: input.kind, resolvedAt: null },
    data: { notifiedAt: now, dismissedAt: null },
  });
}
