import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyUser } from "@/lib/notifications/notify";
import { logError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily: tell each merchant how many CRM follow-ups are due today or overdue.
 * One notification per store (not per lead) so a backlog never floods the bell
 * or push. Only stores with the CRM & Sales app actively installed are included.
 */
export const GET = withCronMonitor("crm-followups", async () => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000 - 1);

  const leads = await prisma.crmLead.findMany({
    where: {
      nextFollowUpAt: { lte: endOfToday },
      status: { notIn: ["WON", "LOST"] },
      store: { status: "ACTIVE", installedPlugins: { some: { status: "ACTIVE", plugin: { key: "crm" } } } },
    },
    select: { storeId: true, nextFollowUpAt: true, store: { select: { slug: true, business: { select: { userId: true } } } } },
    take: 5000,
  });

  const byStore = new Map<string, { slug: string; userId: string; due: number; overdue: number }>();
  for (const l of leads) {
    const entry = byStore.get(l.storeId) ?? { slug: l.store.slug, userId: l.store.business.userId, due: 0, overdue: 0 };
    if (l.nextFollowUpAt && l.nextFollowUpAt < startOfToday) entry.overdue += 1;
    else entry.due += 1;
    byStore.set(l.storeId, entry);
  }

  let notified = 0;
  for (const [storeId, s] of byStore) {
    const total = s.due + s.overdue;
    try {
      await notifyUser({
        userId: s.userId,
        type: "CRM_FOLLOW_UP",
        title: `${total} lead follow-up${total === 1 ? "" : "s"} to do`,
        body: s.overdue ? `${s.due} due today, ${s.overdue} overdue.` : `${s.due} due today.`,
        url: `/store/${s.slug}/admin/apps/crm`,
      });
      notified += 1;
    } catch (err) {
      await logError("API", "CRM follow-up reminder failed", { storeId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ stores: byStore.size, notified });
});
