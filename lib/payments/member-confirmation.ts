import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails a receipt for a settled member payment or gift. Never throws: a failed email must not undo a settlement. */
export async function sendMemberReceiptEmail(reference: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const payment = await prisma.payment.findUnique({ where: { reference }, include: { memberCharge: { include: { member: true, store: true } } } });
    if (!payment || payment.purpose !== "MEMBER_PAYMENT" || payment.status !== "SUCCESSFUL" || !payment.memberCharge) return { sent: false, reason: "not a settled member payment" };
    const c = payment.memberCharge;
    const to = (c.member?.email ?? c.donorEmail)?.trim();
    if (!to) return { sent: false, reason: "no email address" };
    const name = (c.member?.name ?? c.donorName ?? "there").split(" ")[0];
    const portal = c.member?.portalToken ? buildStoreUrl(c.store, `/member/${c.member.portalToken}`) : null;
    const lines = [
      `Hi ${esc(name)},`,
      `We have received your payment for <strong>${esc(c.label)}</strong>. Thank you.`,
      `<strong>Receipt:</strong> ${esc(c.receiptNo ?? "")}<br/><strong>Amount paid:</strong> NGN ${formatNumber(Number(payment.amount))}`,
      portal ? `<a href="${esc(portal)}">View your account</a>` : "",
    ].filter(Boolean);
    await sendOrderNotificationEmail(to, `Receipt ${c.receiptNo ?? ""}`.trim(), lines.join("<br/><br/>"), storeEmailBrand(c.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Member receipt email failed", { reference, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}
