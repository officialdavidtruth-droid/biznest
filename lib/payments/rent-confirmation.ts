import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails the tenant a receipt for a settled rent payment. Never throws: a failed email must not undo a settlement. */
export async function sendRentReceiptEmail(reference: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { rentCharge: { include: { unit: { include: { property: { select: { name: true } } } }, store: true } } },
    });
    if (!payment || payment.purpose !== "RENT_PAYMENT" || payment.status !== "SUCCESSFUL" || !payment.rentCharge) return { sent: false, reason: "not a settled rent payment" };
    const c = payment.rentCharge;
    const to = c.unit.tenantEmail?.trim();
    if (!to) return { sent: false, reason: "tenant has no email address" };
    const portal = c.unit.portalToken ? buildStoreUrl(c.store, `/rent/${c.unit.portalToken}`) : null;
    const lines = [
      `Hi ${esc((c.unit.tenantName ?? "there").split(" ")[0])},`,
      `We have received your payment for <strong>${esc(c.label)}</strong>. Thank you.`,
      `<strong>Receipt:</strong> ${esc(c.receiptNo ?? "")}<br/><strong>Property:</strong> ${esc(c.unit.property.name)}, unit ${esc(c.unit.unitNo)}<br/><strong>Amount paid:</strong> NGN ${formatNumber(Number(payment.amount))}`,
      portal ? `<a href="${esc(portal)}">View your rent account</a>` : "",
    ].filter(Boolean);
    await sendOrderNotificationEmail(to, `Rent receipt ${c.receiptNo ?? ""}`.trim(), lines.join("<br/><br/>"), storeEmailBrand(c.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Rent receipt email failed", { reference, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}
