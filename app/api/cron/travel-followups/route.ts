import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { getPluginEntitlement } from "@/lib/plugins";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { formatNumber } from "@/lib/i18n/locale";
import { TRAVEL_PLUGIN_KEY } from "@/lib/travel";
import { reminderKind } from "@/lib/travel-growth";
import { newShareToken, proposalUrl } from "@/lib/travel-proposal";
import { notifyUser } from "@/lib/notifications/notify";
import { readFlight, ticketsIssued, ticketingAlertDue } from "@/lib/travel-flight";

const BATCH = 300;
const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
const storeSelect = { id: true, name: true, slug: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, customDomain: true, customDomainStatus: true } as const;

/**
 * Daily travel follow-ups for agencies that have BizNest Travel installed:
 *  1. Instalment reminders by email (3 days before, on the day, then weekly while overdue, at most 4 per instalment),
 *     each with the client's own link to pay. Agencies can switch this off in Travel → Settings.
 *  2. A thank-you and review request 2 to 30 days after a trip is marked completed, once per trip.
 *  3. A bell and push alert to the agency when a flight's ticketing deadline is within 2 days (or has just passed) and
 *     not every traveller has a ticket yet, once per flight line. Editing the deadline re-arms it.
 * A reminder is only counted as sent when the email went out, so a failed send is retried the next day.
 */
export const GET = withCronMonitor("travel-followups", async () => {
  const start = Date.now();
  const now = new Date();
  const entitled = new Map<string, boolean>();
  const isEntitled = async (storeId: string) => {
    if (!entitled.has(storeId)) entitled.set(storeId, await getPluginEntitlement(storeId, TRAVEL_PLUGIN_KEY).then((e) => e.allowed && e.installed).catch(() => false));
    return entitled.get(storeId)!;
  };
  let reminded = 0, reviews = 0, failures = 0, ticketing = 0;

  // ---- 1. instalment reminders
  const soon = new Date(now.getTime() + 4 * 86_400_000);
  const dues = await prisma.travelPayment.findMany({
    where: { status: "DUE", dueDate: { lte: soon }, trip: { status: { notIn: ["CANCELLED", "COMPLETED"] }, client: { email: { not: null } } } },
    orderBy: { dueDate: "asc" }, take: BATCH,
    include: { trip: { include: { client: { select: { fullName: true, email: true } }, store: { select: { ...storeSelect, travelSettings: { select: { remindersEnabled: true } } } } } } },
  });
  for (const d of dues) {
    try {
      const trip = d.trip, store = trip.store;
      if (store.travelSettings?.remindersEnabled === false) continue;
      if (!(await isEntitled(store.id))) continue;
      const kind = reminderKind({ dueDate: d.dueDate, reminderCount: d.reminderCount, lastReminderAt: d.lastReminderAt }, now);
      const to = trip.client.email?.trim();
      if (!kind || !to || !(Number(d.amount) > 0)) continue;
      let token = trip.shareToken;
      if (!token) { token = newShareToken(); await prisma.travelTrip.update({ where: { id: trip.id }, data: { shareToken: token } }); }
      const url = proposalUrl(store, token);
      const amount = `${esc(trip.currency)} ${formatNumber(Number(d.amount))}`;
      const due = d.dueDate!.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const lead = kind === "overdue" ? `Your instalment of <strong>${amount}</strong> for <strong>${esc(trip.title)}</strong> was due on ${esc(due)}.`
        : kind === "due" ? `Your instalment of <strong>${amount}</strong> for <strong>${esc(trip.title)}</strong> is due today.`
        : `A reminder that your instalment of <strong>${amount}</strong> for <strong>${esc(trip.title)}</strong> is due on ${esc(due)}.`;
      const html = [`Hi ${esc(trip.client.fullName.split(" ")[0] || "there")},`, lead, `Booking reference: ${esc(trip.reference)}`, `<a href="${esc(url)}">Open your booking to pay online</a>`, `If you have already paid, please ignore this message or reply with your receipt.`].join("<br/><br/>");
      const sent = await sendOrderNotificationEmail(to, kind === "overdue" ? `Payment overdue: ${trip.title}` : `Payment reminder: ${trip.title}`, html, storeEmailBrand(store));
      if (sent?.error) throw new Error(sent.error.message);
      await prisma.travelPayment.update({ where: { id: d.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
      reminded++;
    } catch (err) {
      failures++;
      void logError("JOBS", "travel-followups: reminder failed", errorMeta(err, { paymentId: d.id }));
    }
  }

  // ---- 2. post-trip thank-you and review request
  const trips = await prisma.travelTrip.findMany({
    where: {
      status: "COMPLETED", reviewRequestedAt: null, client: { email: { not: null } },
      OR: [
        { returnDate: { lte: new Date(now.getTime() - 2 * 86_400_000), gte: new Date(now.getTime() - 30 * 86_400_000) } },
        { returnDate: null, departDate: { lte: new Date(now.getTime() - 2 * 86_400_000), gte: new Date(now.getTime() - 30 * 86_400_000) } },
      ],
    },
    take: BATCH,
    include: { client: { select: { fullName: true, email: true } }, store: { select: { ...storeSelect, travelSettings: { select: { reviewUrl: true } } } } },
  });
  for (const t of trips) {
    try {
      if (!(await isEntitled(t.store.id))) continue;
      const to = t.client.email?.trim();
      if (!to) continue;
      const link = t.store.travelSettings?.reviewUrl || buildStoreUrl(t.store, "/");
      const html = [
        `Hi ${esc(t.client.fullName.split(" ")[0] || "there")},`,
        `Welcome back! We hope you had a wonderful time on <strong>${esc(t.title)}</strong>. Thank you for travelling with ${esc(t.store.name)}.`,
        `If you have a minute, we would love to hear how it went. Your feedback helps other travellers choose with confidence.`,
        `<a href="${esc(link)}">${t.store.travelSettings?.reviewUrl ? "Leave a review" : "Visit us again"}</a>`,
      ].join("<br/><br/>");
      const sent = await sendOrderNotificationEmail(to, `How was ${t.title}?`, html, storeEmailBrand(t.store));
      if (sent?.error) throw new Error(sent.error.message);
      await prisma.travelTrip.update({ where: { id: t.id }, data: { reviewRequestedAt: now } });
      reviews++;
    } catch (err) {
      failures++;
      void logError("JOBS", "travel-followups: review email failed", errorMeta(err, { tripId: t.id }));
    }
  }

  // ---- 3. ticketing deadlines
  const lines = await prisma.travelTripItem.findMany({
    where: {
      kind: "FLIGHT", status: { not: "CANCELLED" }, ticketingAlertedAt: null,
      ticketingDeadline: { gte: new Date(now.getTime() - 7 * 86_400_000), lte: new Date(now.getTime() + 2 * 86_400_000) },
      trip: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
    },
    orderBy: { ticketingDeadline: "asc" }, take: BATCH,
    select: {
      id: true, description: true, ticketingDeadline: true, ticketingAlertedAt: true, flightDetails: true,
      trip: { select: { title: true, reference: true, travellers: { select: { id: true } }, store: { select: { id: true, slug: true, business: { select: { userId: true } } } } } },
    },
  });
  for (const it of lines) {
    try {
      const store = it.trip.store;
      if (!(await isEntitled(store.id))) continue;
      const issued = ticketsIssued(readFlight(it.flightDetails), it.trip.travellers.length);
      if (!ticketingAlertDue(it.ticketingDeadline, issued, !!it.ticketingAlertedAt, now)) continue;
      const userId = store.business?.userId;
      if (!userId) continue;
      const passed = it.ticketingDeadline!.getTime() < now.getTime();
      const when = it.ticketingDeadline!.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
      await notifyUser({
        userId, type: "TRAVEL_TICKETING",
        title: passed ? `Ticketing deadline passed: ${it.trip.title}` : `Issue tickets soon: ${it.trip.title}`,
        body: `${it.description} (${it.trip.reference}): ${passed ? "the airline's ticketing deadline was" : "tickets must be issued by"} ${when} (Lagos time) and not every traveller has a ticket number yet.`,
        url: `/store/${store.slug}/admin/travel`,
      });
      await prisma.travelTripItem.update({ where: { id: it.id }, data: { ticketingAlertedAt: now } });
      ticketing++;
    } catch (err) {
      failures++;
      void logError("JOBS", "travel-followups: ticketing alert failed", errorMeta(err, { itemId: it.id }));
    }
  }

  void logInfo("JOBS", "travel-followups completed", { reminded, reviews, ticketing, failures }, Date.now() - start);
  return NextResponse.json({ reminded, reviews, ticketing, failures });
});
