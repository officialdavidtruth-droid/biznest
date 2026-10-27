import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";
import { logError, errorMeta } from "@/lib/observability/log";
import { APP_URL } from "@/lib/constants/app-url";
import { CHURN_COPY } from "@/lib/churn/copy";
import { detectChurnSignals, signalKey, type DetectedSignal } from "@/lib/churn/signals";

const BATCH = 200;

function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Daily sweep. For every live store: detect warning signs, open a ChurnSignal
 * row the first time one appears (and nudge the owner once, in-app + push + email),
 * refresh it while it persists, and resolve it when it clears.
 */
export async function runChurnWatch(now = new Date()) {
  let scanned = 0, opened = 0, resolved = 0, nudged = 0, failures = 0;
  let cursor: string | undefined;

  for (;;) {
    const stores = await prisma.store.findMany({
      where: { status: "ACTIVE", marketingOnly: false },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, slug: true, name: true, createdAt: true, subscriptionPastDueSince: true,
        business: { select: { userId: true, user: { select: { email: true, lastLoginAt: true } } } },
        plugins: {
          where: { status: "ACTIVE", plugin: { isFree: false } },
          select: { installedAt: true, pastDueSince: true, plugin: { select: { key: true, name: true } } },
        },
      },
    });
    if (stores.length === 0) break;
    cursor = stores[stores.length - 1].id;
    const ids = stores.map((s) => s.id);

    const [orders, activity, openRows] = await Promise.all([
      prisma.order.groupBy({ by: ["storeId"], where: { storeId: { in: ids }, status: { in: SELLER_VISIBLE_ORDER_STATUSES } }, _max: { createdAt: true } }),
      prisma.storeActivityLog.groupBy({ by: ["storeId"], where: { storeId: { in: ids } }, _max: { createdAt: true } }),
      prisma.churnSignal.findMany({ where: { storeId: { in: ids }, resolvedAt: null } }),
    ]);
    const lastOrder = new Map(orders.map((o) => [o.storeId, o._max.createdAt]));
    const lastActivity = new Map(activity.map((a) => [a.storeId, a._max.createdAt]));

    for (const store of stores) {
      scanned++;
      try {
        const detected = detectChurnSignals({
          now,
          storeCreatedAt: store.createdAt,
          ownerLastLoginAt: store.business.user.lastLoginAt,
          lastOrderAt: lastOrder.get(store.id) ?? null,
          lastActivityAt: lastActivity.get(store.id) ?? null,
          subscriptionPastDueSince: store.subscriptionPastDueSince,
          paidPlugins: store.plugins.map((p) => ({ key: p.plugin.key, name: p.plugin.name, installedAt: p.installedAt, pastDueSince: p.pastDueSince })),
        });
        const detectedMap = new Map<string, DetectedSignal>(detected.map((d) => [signalKey(d.kind, d.subject), d]));
        const mine = openRows.filter((r) => r.storeId === store.id);
        const mineMap = new Map(mine.map((r) => [signalKey(r.kind, r.subject), r]));

        for (const row of mine) {
          const d = detectedMap.get(signalKey(row.kind, row.subject));
          if (d) await prisma.churnSignal.update({ where: { id: row.id }, data: { lastDetectedAt: now, detail: d.detail } });
          else { await prisma.churnSignal.update({ where: { id: row.id }, data: { resolvedAt: now } }); resolved++; }
        }

        for (const d of detected) {
          if (mineMap.has(signalKey(d.kind, d.subject))) continue;
          try {
            await prisma.churnSignal.create({ data: { storeId: store.id, kind: d.kind, subject: d.subject, detail: d.detail, firstDetectedAt: now, lastDetectedAt: now } });
          } catch (err) {
            // Partial unique index: a concurrent run already opened it.
            if ((err as { code?: string }).code === "P2002") continue;
            throw err;
          }
          opened++;
          const copy = CHURN_COPY[d.kind];
          await notifyUser({ userId: store.business.userId, type: "CHURN_TIP", title: copy.title, body: copy.body, url: copy.href(store.slug) });
          const email = store.business.user.email;
          if (email) {
            // Email matters most for NO_LOGIN: they aren't opening the bell.
            await sendOrderNotificationEmail(
              email,
              copy.title,
              `<p>${escapeHtml(copy.body)}</p><p><a href="${APP_URL}${copy.href(store.slug)}">${escapeHtml(copy.cta)}</a></p>`
            ).catch((err) => void logError("EMAIL", "churn nudge email failed", errorMeta(err, { storeId: store.id })));
          }
          await prisma.churnSignal.updateMany({ where: { storeId: store.id, kind: d.kind, subject: d.subject, resolvedAt: null }, data: { notifiedAt: now } });
          nudged++;
        }
      } catch (err) {
        failures++;
        void logError("JOBS", "churn-watch: store failed", errorMeta(err, { storeId: store.id }));
      }
    }
    if (stores.length < BATCH) break;
  }
  return { scanned, opened, resolved, nudged, failures };
}
