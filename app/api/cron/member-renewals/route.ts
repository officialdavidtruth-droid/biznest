import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { formatNumber } from "@/lib/i18n/locale";
import { memberReminderKind, nextRenewal, periodText, isPlanInterval, renewalDue } from "@/lib/members";

const BATCH = 300;
const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/**
 * Daily membership upkeep:
 * 1. bills the next period for memberships renewing within 7 days (guarded by an updateMany on renewsAt so two runs never double-bill),
 * 2. ends memberships and packages past their end date,
 * 3. emails reminders for unpaid dues (3 days before, on the day, weekly while overdue, max 4),
 * 4. cancels abandoned online gifts left unpaid for more than 2 days.
 */
export const GET = withCronMonitor("member-renewals", async () => {
  const start = Date.now();
  const now = new Date();
  let billed = 0, expired = 0, reminded = 0, voided = 0, failures = 0;

  const renewing = await prisma.membership.findMany({
    where: { status: "ACTIVE", renewsAt: { not: null, lte: new Date(now.getTime() + 7 * 86_400_000) }, member: { active: true }, store: { status: "ACTIVE" } },
    take: BATCH, include: { plan: true },
  });
  for (const ms of renewing) {
    try {
      if (!ms.renewsAt || !isPlanInterval(ms.plan.interval) || !ms.plan.active || !renewalDue(ms, now)) continue;
      const next = nextRenewal(ms.renewsAt, ms.plan.interval);
      const claim = await prisma.membership.updateMany({ where: { id: ms.id, renewsAt: ms.renewsAt }, data: { renewsAt: next } });
      if (claim.count === 0) continue; // another run billed it first
      if (Number(ms.plan.price) > 0) {
        await prisma.memberCharge.create({ data: { storeId: ms.storeId, memberId: ms.memberId, membershipId: ms.id, kind: "DUES", label: `${ms.plan.name}: ${periodText(ms.renewsAt, ms.plan.interval)}`, amount: ms.plan.price, dueDate: ms.renewsAt } });
        billed++;
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "member-renewals: billing failed", errorMeta(err, { membershipId: ms.id }));
    }
  }

  const ended = await prisma.membership.updateMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, data: { status: "CANCELLED" } });
  expired = ended.count;

  const charges = await prisma.memberCharge.findMany({
    where: { status: "DUE", memberId: { not: null }, dueDate: { lte: new Date(now.getTime() + 4 * 86_400_000) }, member: { active: true, email: { not: null } }, store: { status: "ACTIVE" } },
    orderBy: { dueDate: "asc" }, take: BATCH,
    include: { member: true, store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, customDomain: true, customDomainStatus: true } } },
  });
  for (const c of charges) {
    try {
      const kind = memberReminderKind({ dueDate: c.dueDate, reminderCount: c.reminderCount, lastReminderAt: c.lastReminderAt }, now);
      const to = c.member?.email?.trim();
      if (!kind || !to || !c.member || !(Number(c.amount) > 0)) continue;
      const url = buildStoreUrl(c.store, `/member/${c.member.portalToken}`);
      const amount = `NGN ${formatNumber(Number(c.amount))}`;
      const due = c.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const lead = kind === "overdue" ? `Your payment of <strong>${amount}</strong> (${esc(c.label)}) was due on ${esc(due)}.`
        : kind === "due" ? `Your payment of <strong>${amount}</strong> (${esc(c.label)}) is due today.`
        : `A reminder that your payment of <strong>${amount}</strong> (${esc(c.label)}) is due on ${esc(due)}.`;
      const html = [`Hi ${esc(c.member.name.split(" ")[0] || "there")},`, lead, `<a href="${esc(url)}">Open your account to pay online</a>`, `If you have already paid, please ignore this message.`].join("<br/><br/>");
      const sent = await sendOrderNotificationEmail(to, kind === "overdue" ? `Payment overdue: ${c.label}` : `Payment reminder: ${c.label}`, html, storeEmailBrand(c.store));
      if (sent?.error) throw new Error(sent.error.message);
      await prisma.memberCharge.update({ where: { id: c.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
      reminded++;
    } catch (err) {
      failures++;
      void logError("JOBS", "member-renewals: reminder failed", errorMeta(err, { chargeId: c.id }));
    }
  }

  // Abandoned online gifts: a visitor opened checkout and left. Only gifts with no member and no money received.
  const stale = await prisma.memberCharge.updateMany({
    where: { kind: "GIVING", status: "DUE", memberId: null, createdAt: { lt: new Date(now.getTime() - 2 * 86_400_000) }, payments: { none: { status: "SUCCESSFUL" } } },
    data: { status: "VOID" },
  });
  voided = stale.count;

  void logInfo("JOBS", "member-renewals completed", { billed, expired, reminded, voided, failures }, Date.now() - start);
  return NextResponse.json({ ok: true, billed, expired, reminded, voided, failures });
});
