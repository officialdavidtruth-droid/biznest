import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { formatNumber } from "@/lib/i18n/locale";
import { notifyUser } from "@/lib/notifications/notify";
import { rentReminderKind } from "@/lib/real-estate";

const BATCH = 300;
const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/**
 * Daily rent reminders for tenants with an email address: 3 days before, on the day, then weekly while overdue,
 * at most 4 per charge, each with the tenant's own portal link to pay. A reminder only counts as sent when the email
 * went out, so a failed send is retried the next day. Landlords get one bell per day-of-run summarising new overdue rent.
 */
export const GET = withCronMonitor("rent-reminders", async () => {
  const start = Date.now();
  const now = new Date();
  const soon = new Date(now.getTime() + 4 * 86_400_000);
  let reminded = 0, failures = 0;

  const charges = await prisma.rentCharge.findMany({
    where: { status: "DUE", dueDate: { lte: soon }, unit: { tenantEmail: { not: null }, portalToken: { not: null } }, store: { status: "ACTIVE" } },
    orderBy: { dueDate: "asc" }, take: BATCH,
    include: { unit: { include: { property: { select: { name: true } } } }, store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, customDomain: true, customDomainStatus: true } } },
  });

  for (const c of charges) {
    try {
      const kind = rentReminderKind({ dueDate: c.dueDate, reminderCount: c.reminderCount, lastReminderAt: c.lastReminderAt }, now);
      const to = c.unit.tenantEmail?.trim();
      if (!kind || !to || !c.unit.portalToken || !(Number(c.amount) > 0)) continue;
      const url = buildStoreUrl(c.store, `/rent/${c.unit.portalToken}`);
      const amount = `NGN ${formatNumber(Number(c.amount))}`;
      const due = c.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const where = `${esc(c.unit.property.name)}, unit ${esc(c.unit.unitNo)}`;
      const lead = kind === "overdue" ? `Your payment of <strong>${amount}</strong> (${esc(c.label)}) for ${where} was due on ${esc(due)}.`
        : kind === "due" ? `Your payment of <strong>${amount}</strong> (${esc(c.label)}) for ${where} is due today.`
        : `A reminder that your payment of <strong>${amount}</strong> (${esc(c.label)}) for ${where} is due on ${esc(due)}.`;
      const html = [`Hi ${esc((c.unit.tenantName ?? "there").split(" ")[0] || "there")},`, lead, `<a href="${esc(url)}">Open your rent account to pay online</a>`, `If you have already paid, please ignore this message or reply with your receipt.`].join("<br/><br/>");
      const sent = await sendOrderNotificationEmail(to, kind === "overdue" ? `Rent overdue: ${c.unit.unitNo}` : `Rent reminder: ${c.unit.unitNo}`, html, storeEmailBrand(c.store));
      if (sent?.error) throw new Error(sent.error.message);
      await prisma.rentCharge.update({ where: { id: c.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
      reminded++;
    } catch (err) {
      failures++;
      void logError("JOBS", "rent-reminders: reminder failed", errorMeta(err, { chargeId: c.id }));
    }
  }

  // One bell per landlord per run for rent that went overdue since yesterday.
  let alerted = 0;
  const yesterday = new Date(now.getTime() - 86_400_000);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()));
  const fresh = await prisma.rentCharge.findMany({
    where: { status: "DUE", dueDate: { gte: startOfYesterday, lt: startOfToday }, store: { status: "ACTIVE" } },
    take: BATCH, select: { storeId: true, amount: true, store: { select: { slug: true, business: { select: { user: { select: { id: true } } } } } } },
  });
  const byStore = new Map<string, { slug: string; ownerId?: string; count: number; total: number }>();
  for (const f of fresh) {
    const row = byStore.get(f.storeId) ?? { slug: f.store.slug, ownerId: f.store.business?.user?.id, count: 0, total: 0 };
    row.count += 1; row.total += Number(f.amount);
    byStore.set(f.storeId, row);
  }
  for (const row of byStore.values()) {
    if (!row.ownerId) continue;
    try {
      await notifyUser({ userId: row.ownerId, type: "RENT_OVERDUE", title: `${row.count} rent payment${row.count === 1 ? "" : "s"} went overdue`, body: `NGN ${formatNumber(row.total)} is now past due. Tenants have been reminded.`, url: `/store/${row.slug}/admin/real-estate` });
      alerted++;
    } catch (err) {
      void logError("JOBS", "rent-reminders: landlord alert failed", errorMeta(err, { slug: row.slug }));
    }
  }

  void logInfo("JOBS", "rent-reminders completed", { reminded, failures, alerted }, Date.now() - start);
  return NextResponse.json({ ok: true, reminded, failures, alerted });
});
