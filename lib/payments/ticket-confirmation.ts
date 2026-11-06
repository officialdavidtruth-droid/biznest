import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails the buyer a link to their QR tickets. Used for paid orders (by payment reference) and free/comp orders (by order id). */
export async function sendTicketEmailForOrder(orderId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const order = await prisma.ticketOrder.findUnique({ where: { id: orderId }, include: { event: true, store: true, items: { include: { tier: { select: { name: true } } } } } });
    if (!order || order.status !== "PAID") return { sent: false, reason: "order is not paid" };
    const to = order.buyerEmail?.trim();
    if (!to) return { sent: false, reason: "no email address" };
    const link = buildStoreUrl(order.store, `/ticket/${order.accessToken}`);
    const when = order.event.startsAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const lines = [
      `Hi ${esc(order.buyerName.split(" ")[0] || "there")},`,
      `Your tickets for <strong>${esc(order.event.title)}</strong> are ready.`,
      `<strong>When:</strong> ${esc(when)}${order.event.venue ? `<br/><strong>Where:</strong> ${esc(order.event.venue)}` : ""}<br/>${order.items.map((i) => `${i.qty} × ${esc(i.tier.name)}`).join(", ")}${Number(order.total) > 0 ? `<br/><strong>Paid:</strong> NGN ${formatNumber(Number(order.total))}` : ""}${order.receiptNo ? `<br/><strong>Receipt:</strong> ${esc(order.receiptNo)}` : ""}`,
      `<a href="${esc(link)}">Open your tickets</a> and show the QR code at the entrance.`,
    ];
    await sendOrderNotificationEmail(to, `Your tickets: ${order.event.title}`, lines.join("<br/><br/>"), storeEmailBrand(order.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Ticket email failed", { orderId, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}

export async function sendTicketEmail(reference: string): Promise<{ sent: boolean; reason?: string }> {
  const p = await prisma.payment.findUnique({ where: { reference }, select: { ticketOrderId: true, purpose: true, status: true } });
  if (!p || p.purpose !== "TICKET_PURCHASE" || p.status !== "SUCCESSFUL" || !p.ticketOrderId) return { sent: false, reason: "not a settled ticket payment" };
  return sendTicketEmailForOrder(p.ticketOrderId);
}
