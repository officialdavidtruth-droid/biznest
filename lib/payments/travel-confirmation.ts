import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";
import { notifyUser } from "@/lib/notifications/notify";
import { APP_URL } from "@/lib/constants/app-url";
import { netReceived } from "@/lib/travel";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/**
 * Emails the traveller a branded receipt for a settled tour payment, with their booking reference and a link
 * to the booking-status page. Sent under the agency's own name. Never throws: a failed email must not undo
 * or retry a payment settlement (failures are logged by the email sender and here).
 */
export async function sendTravelPaymentEmail(reference: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { travelTrip: { include: { client: true, store: true, travellers: { select: { id: true } }, payments: { select: { amount: true, status: true, refundedAmount: true } } } } },
    });
    if (!payment || payment.purpose !== "TRAVEL_BOOKING" || payment.status !== "SUCCESSFUL" || !payment.travelTrip) return { sent: false, reason: "not a settled travel payment" };
    const trip = payment.travelTrip;
    const to = trip.client.email?.trim();
    if (!to) return { sent: false, reason: "traveller has no email address" };

    const confirmed = ["CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED"].includes(trip.status);
    const paid = trip.payments.reduce((s, p) => s + netReceived(p), 0);
    const total = Number(trip.totalPrice);
    const balance = Math.max(0, total - paid);
    const money = (n: number) => `${esc(payment.currency)} ${formatNumber(n)}`;
    const url = buildStoreUrl(trip.store, `/travel/${reference}`);
    const dep = trip.departDate ? new Date(trip.departDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

    const subject = confirmed ? `Booking confirmed: ${trip.title}` : `Payment received: ${trip.title}`;
    const lines = [
      `Hi ${esc(trip.client.fullName.split(" ")[0] || "there")},`,
      confirmed
        ? `Thank you. Your place on <strong>${esc(trip.title)}</strong> (${esc(trip.destination)}) is confirmed.`
        : `Thank you. We have received your payment for <strong>${esc(trip.title)}</strong> (${esc(trip.destination)}). We are confirming availability and will contact you shortly.`,
      `<strong>Booking reference:</strong> ${esc(trip.reference)}<br/>` +
        `<strong>Travellers:</strong> ${trip.travellers.length}<br/>` +
        (dep ? `<strong>Departure:</strong> ${esc(dep)}<br/>` : "") +
        `<strong>Paid now:</strong> ${money(Number(payment.amount))}<br/>` +
        (total > 0 ? `<strong>Total price:</strong> ${money(total)}<br/><strong>Balance remaining:</strong> ${money(balance)}` : ""),
      balance > 0 && confirmed ? `The agency will be in touch about the balance. Keep your booking reference handy.` : "",
      `<a href="${esc(url)}">View your booking</a>`,
    ].filter(Boolean);

    await sendOrderNotificationEmail(to, subject, lines.join("<br/><br/>"), storeEmailBrand(trip.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Travel payment email failed", { reference, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}

/**
 * Tells the traveller a refund has been recorded. Online refunds go back to the original payment method; for payments
 * the agency collected itself, the agency arranges the repayment. Never throws.
 */
export async function sendTravelRefundEmail(tripId: string, amount: number, full: boolean, mode: "gateway" | "recorded"): Promise<{ sent: boolean; reason?: string }> {
  try {
    const trip = await prisma.travelTrip.findUnique({ where: { id: tripId }, include: { client: true, store: true } });
    if (!trip) return { sent: false, reason: "trip not found" };
    const to = trip.client.email?.trim();
    if (!to) return { sent: false, reason: "traveller has no email address" };
    const money = `${esc(trip.currency)} ${formatNumber(amount)}`;
    const how = mode === "gateway"
      ? "It is being returned to the card or bank account you paid with. Banks usually take a few working days to show it."
      : "Your agency will arrange the repayment with you directly.";
    const lines = [
      `Hi ${esc(trip.client.fullName.split(" ")[0] || "there")},`,
      `A ${full ? "full" : "partial"} refund of <strong>${money}</strong> has been recorded for <strong>${esc(trip.title)}</strong> (booking reference ${esc(trip.reference)}).`,
      how,
      `If you have any questions, please reply to the agency directly.`,
    ];
    await sendOrderNotificationEmail(to, `Refund recorded: ${trip.title}`, lines.join("<br/><br/>"), storeEmailBrand(trip.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Travel refund email failed", { tripId, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}

export type TravelPaymentCase = "normal" | "sold_out" | "cancelled";

/** What the agency needs to know about a settled payment, from the trip's state after settlement. */
export function classifyTravelPayment(tripStatus: string): TravelPaymentCase {
  if (tripStatus === "CANCELLED") return "cancelled";
  if (tripStatus === "ENQUIRY" || tripStatus === "QUOTED") return "sold_out"; // paid, but settlement could not confirm it (no seats left)
  return "normal";
}

/**
 * Tells the agency owner about a settled tour payment: a dashboard notification plus an email.
 * Payments that need a human (tour sold out, trip cancelled) are flagged "Action needed" with the refund step.
 * Never throws; a failed alert must not affect the payment.
 */
export async function notifyAgencyOfTravelPayment(reference: string): Promise<{ notified: boolean; reason?: string }> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { travelTrip: { include: { client: { select: { fullName: true } }, store: { include: { business: { include: { user: { select: { id: true, email: true } } } } } } } } },
    });
    if (!payment || payment.purpose !== "TRAVEL_BOOKING" || payment.status !== "SUCCESSFUL" || !payment.travelTrip) return { notified: false, reason: "not a settled travel payment" };
    const trip = payment.travelTrip;
    const owner = trip.store.business?.user;
    if (!owner) return { notified: false, reason: "no owner to notify" };

    const kind = classifyTravelPayment(trip.status);
    const money = `${esc(payment.currency)} ${formatNumber(Number(payment.amount))}`;
    const who = esc(trip.client.fullName);
    const link = `${APP_URL}/store/${trip.store.slug}/admin/travel`;
    const title =
      kind === "normal" ? `New paid booking: ${trip.title}`
      : kind === "sold_out" ? "Action needed: paid, but the tour is full"
      : "Action needed: payment on a cancelled trip";
    const detail =
      kind === "normal" ? `${trip.client.fullName} paid ${payment.currency} ${formatNumber(Number(payment.amount))} for ${trip.title}. The trip is ${trip.status.toLowerCase()}.`
      : kind === "sold_out" ? `${trip.client.fullName} paid ${payment.currency} ${formatNumber(Number(payment.amount))} for ${trip.title} but there were not enough seats left, so the trip was not confirmed. Refund them or move them to another departure.`
      : `${trip.client.fullName} paid ${payment.currency} ${formatNumber(Number(payment.amount))} for ${trip.title}, which is cancelled. A refund is probably due.`;
    const html =
      `<strong>${esc(title)}</strong><br/><br/>` +
      (kind === "normal" ? `${who} paid <strong>${money}</strong> for <strong>${esc(trip.title)}</strong> (${esc(trip.destination)}). The trip is now ${esc(trip.status.toLowerCase())}.`
        : kind === "sold_out" ? `${who} paid <strong>${money}</strong> for <strong>${esc(trip.title)}</strong>, but the tour had no seats left when the payment arrived, so the trip was <strong>not confirmed</strong>.<br/><br/>Refund the traveller from your payment gateway (or move them to another departure), then void the payment on the trip.`
        : `${who} paid <strong>${money}</strong> for <strong>${esc(trip.title)}</strong>, which is cancelled. A refund is probably due: open the trip in BizNest Travel and use Refund on the payment.`) +
      `<br/><br/>Booking reference: ${esc(trip.reference)}<br/>Payment reference: ${esc(reference)}<br/><br/><a href="${esc(link)}">Open BizNest Travel</a>`;

    await Promise.allSettled([
      notifyUser({ userId: owner.id, type: "TRAVEL_PAID", title, body: detail, url: `/store/${trip.store.slug}/admin/travel` }),
      owner.email ? sendOrderNotificationEmail(owner.email, kind === "normal" ? `${title} (${trip.store.name})` : title, html) : Promise.resolve(),
    ]);
    return { notified: true };
  } catch (err) {
    void logError("PAYMENTS", "Travel agency alert failed", { reference, error: err instanceof Error ? err.message : String(err) });
    return { notified: false, reason: "failed" };
  }
}
