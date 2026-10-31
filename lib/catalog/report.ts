import type { WebhookEventType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { logStoreActivity } from "@/lib/activity-log";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";

/**
 * Audit log + webhook for a catalog change, in one place. Call it after the
 * transaction commits. Reporting is best-effort by design: a dead webhook
 * subscriber or a logging hiccup must never fail (or roll back) an edit the
 * merchant has already saved. Every catalog write path calls this, so a new path
 * can't forget one half of it.
 */
export async function reportCatalogChange(
  storeId: string,
  change: {
    action: string;
    target: string;
    metadata?: Record<string, unknown>;
    webhook?: { event: WebhookEventType; payload: Record<string, unknown> };
  },
  actor?: { id?: string | null; name?: string | null; email?: string | null; role: string }
): Promise<void> {
  try {
    const resolved =
      actor ??
      (await auth().then((s) => ({ id: s?.user?.id, name: s?.user?.name, email: s?.user?.email, role: s?.user?.role ?? "unknown" })));
    await logStoreActivity({ storeId, actor: resolved, action: change.action, target: change.target, metadata: change.metadata });
  } catch {
    // see above
  }
  if (!change.webhook) return;
  try {
    await emitWebhookEvent(change.webhook.event, storeId, change.webhook.payload);
  } catch {
    // see above
  }
}
