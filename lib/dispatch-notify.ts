import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails the customer a tracking link when their delivery is on the way or done. Never throws. */
export async function emailDeliveryUpdate(deliveryId: string, kind: "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED"): Promise<void> {
  try {
    const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { store: true, rider: { select: { name: true } } } });
    const to = d?.customerEmail?.trim();
    if (!d || !to) return;
    const link = buildStoreUrl(d.store, `/track/${d.trackToken}`);
    const first = esc(d.customerName.split(" ")[0] || "there");
    const body: Record<typeof kind, { subject: string; lines: string[] }> = {
      ASSIGNED: { subject: `Your delivery ${d.jobNo} is booked`, lines: [`Hi ${first},`, `Your delivery <strong>${esc(d.jobNo)}</strong> has been assigned to ${d.rider ? esc(d.rider.name) : "a rider"}.`, `<a href="${esc(link)}">Track it here</a>. When the rider arrives, give them the 4-digit code shown on that page.`] },
      PICKED_UP: { subject: `Your delivery ${d.jobNo} is on the way`, lines: [`Hi ${first},`, `Your package has been picked up and is on its way.`, `<a href="${esc(link)}">Track it here</a>. Have your 4-digit delivery code ready.`] },
      DELIVERED: { subject: `Delivered: ${d.jobNo}`, lines: [`Hi ${first},`, `Your delivery <strong>${esc(d.jobNo)}</strong> was completed. Thank you!`, `<a href="${esc(link)}">View details</a>`] },
      FAILED: { subject: `We couldn't deliver ${d.jobNo}`, lines: [`Hi ${first},`, `We couldn't complete your delivery${d.failureReason ? `: ${esc(d.failureReason)}` : ""}. ${esc(d.store.name)} will be in touch.`, `<a href="${esc(link)}">View details</a>`] },
    };
    const b = body[kind];
    await sendOrderNotificationEmail(to, b.subject, b.lines.join("<br/><br/>"), storeEmailBrand(d.store));
  } catch (err) {
    void logError("EMAIL", "Delivery update email failed", { deliveryId, kind, error: err instanceof Error ? err.message : String(err) });
  }
}
