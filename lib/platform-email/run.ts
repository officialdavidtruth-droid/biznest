import "server-only";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/constants/app-url";
import { sendPlatformEmail } from "@/lib/email/send";
import { audienceWhere, isAudience } from "@/lib/platform-email/audience";
import { ctaButton, reminderCopy, safeCtaUrl, textToParagraphs, type ReminderStage } from "@/lib/platform-email/templates";

const DAY = 24 * 60 * 60 * 1000;
// Day 1 / day 3 / day 7 after signup. Accounts older than the last window + grace are left alone,
// so switching this on never blasts long-standing sign-ups.
const STAGES: { stage: ReminderStage; afterDays: number }[] = [
  { stage: 3, afterDays: 7 },
  { stage: 2, afterDays: 3 },
  { stage: 1, afterDays: 1 },
];
const MAX_AGE_DAYS = 14;
const REMINDER_BATCH = 150;

function firstNameOf(name: string | null, email: string) {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || email.split("@")[0] || "there";
}

/**
 * Daily: for verified accounts with no store, send the single latest reminder
 * that is due and hasn't been sent (day 1, 3 or 7 after signup). Stops by itself
 * once a store exists, a business application is still under review, or the
 * person unsubscribes.
 */
export async function runSignupReminders() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: {
      ...audienceWhere("ALL"),
      role: "CUSTOMER",
      createdAt: { lte: new Date(now - DAY), gte: new Date(now - MAX_AGE_DAYS * DAY) },
      OR: [
        { business: { is: null } },
        { business: { is: { verificationStatus: "APPROVED", store: { is: null } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      business: { select: { id: true } },
      platformEmailLogs: { where: { kind: { startsWith: "REMINDER_" } }, select: { kind: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
    take: REMINDER_BATCH,
  });

  let sent = 0;
  let skipped = 0;
  let failures = 0;
  for (const u of users) {
    const ageDays = (now - u.createdAt.getTime()) / DAY;
    const due = STAGES.find((s) => ageDays >= s.afterDays);
    if (!due) { skipped++; continue; }
    const logged = new Set(u.platformEmailLogs.map((l) => l.kind));
    // Already sent this stage or a later one, or sent any reminder in the last day.
    if (STAGES.some((s) => s.stage >= due.stage && logged.has(`REMINDER_${s.stage}`))) { skipped++; continue; }
    if (u.platformEmailLogs.some((l) => now - l.createdAt.getTime() < DAY)) { skipped++; continue; }

    const kind = `REMINDER_${due.stage}`;
    // Claim first: the unique key stops a double send if two runs overlap.
    try {
      await prisma.platformEmailLog.create({ data: { userId: u.id, kind } });
    } catch {
      skipped++;
      continue;
    }
    const copy = reminderCopy(due.stage, !!u.business, firstNameOf(u.name, u.email));
    try {
      const res = await sendPlatformEmail({
        userId: u.id,
        email: u.email,
        subject: copy.subject,
        preheader: copy.preheader,
        bodyHtml: copy.body + ctaButton(copy.ctaLabel, `${APP_URL}${copy.path}`),
        kind: "platform-reminder",
      });
      if (res.success) sent++;
      else {
        failures++;
        await prisma.platformEmailLog.deleteMany({ where: { userId: u.id, kind } });
      }
    } catch {
      failures++;
      await prisma.platformEmailLog.deleteMany({ where: { userId: u.id, kind } });
    }
  }
  return { scanned: users.length, sent, skipped, failures };
}

/** Builds the HTML body of a campaign for one recipient. */
export function campaignBodyHtml(c: { body: string; ctaLabel: string | null; ctaUrl: string | null }, firstName: string) {
  const text = c.body.replace(/\{name\}/gi, firstName);
  const url = safeCtaUrl(c.ctaUrl, APP_URL);
  return textToParagraphs(text) + (url && c.ctaLabel ? ctaButton(c.ctaLabel, url) : "");
}

const CAMPAIGN_BATCH = 60;

/**
 * Sends up to `limit` not-yet-sent emails of a campaign. Returns how many are
 * still waiting; the daily job and the "Send next batch" button call it again until zero.
 */
export async function processCampaign(campaignId: string, limit = CAMPAIGN_BATCH) {
  const campaign = await prisma.platformCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === "DRAFT" || !isAudience(campaign.audience)) return { sent: 0, remaining: 0, failures: 0 };
  const kind = `CAMPAIGN:${campaign.id}`;
  const where = { ...audienceWhere(campaign.audience), platformEmailLogs: { none: { kind } } };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failures = 0;
  for (const u of users) {
    try {
      await prisma.platformEmailLog.create({ data: { userId: u.id, kind } });
    } catch {
      continue;
    }
    try {
      const res = await sendPlatformEmail({
        userId: u.id,
        email: u.email,
        subject: campaign.subject.replace(/\{name\}/gi, firstNameOf(u.name, u.email)),
        bodyHtml: campaignBodyHtml(campaign, firstNameOf(u.name, u.email)),
        kind: "platform-campaign",
      });
      if (res.success) sent++;
      else {
        failures++;
        await prisma.platformEmailLog.deleteMany({ where: { userId: u.id, kind } });
      }
    } catch {
      failures++;
      await prisma.platformEmailLog.deleteMany({ where: { userId: u.id, kind } });
    }
  }

  const remaining = await prisma.user.count({ where });
  await prisma.platformCampaign.update({
    where: { id: campaign.id },
    data: {
      sentCount: { increment: sent },
      // A batch that failed outright keeps the campaign SENDING so the next run retries it.
      ...(remaining === 0 ? { status: "SENT", sentAt: new Date() } : {}),
    },
  });
  return { sent, remaining, failures };
}

/** Continues every campaign that is still mid-send (used by the daily job). */
export async function continueSendingCampaigns() {
  const open = await prisma.platformCampaign.findMany({ where: { status: "SENDING" }, select: { id: true }, take: 3 });
  let sent = 0;
  let failures = 0;
  for (const c of open) {
    const r = await processCampaign(c.id, 100);
    sent += r.sent;
    failures += r.failures;
  }
  return { campaigns: open.length, sent, failures };
}
