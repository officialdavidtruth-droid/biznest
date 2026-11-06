import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { buildStoreUrl } from "@/lib/store-url";
import { logError } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";

const esc = (v: string) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

/** Emails the customer a receipt for a settled job payment. Never throws: a failed email must not undo a settlement. */
export async function sendJobReceiptEmail(reference: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const payment = await prisma.payment.findUnique({ where: { reference }, include: { jobCharge: { include: { job: true, store: true } } } });
    if (!payment || payment.purpose !== "JOB_PAYMENT" || payment.status !== "SUCCESSFUL" || !payment.jobCharge) return { sent: false, reason: "not a settled job payment" };
    const c = payment.jobCharge;
    const to = c.job.customerEmail?.trim();
    if (!to) return { sent: false, reason: "customer has no email address" };
    const link = buildStoreUrl(c.store, `/job/${c.job.accessToken}`);
    const lines = [
      `Hi ${esc(c.job.customerName.split(" ")[0] || "there")},`,
      `We have received your payment for <strong>${esc(c.label)}</strong> (${esc(c.job.jobNo)}: ${esc(c.job.title)}). Thank you.`,
      `<strong>Receipt:</strong> ${esc(c.receiptNo ?? "")}<br/><strong>Amount paid:</strong> NGN ${formatNumber(Number(payment.amount))}`,
      `<a href="${esc(link)}">View your job</a>`,
    ];
    await sendOrderNotificationEmail(to, `Receipt ${c.receiptNo ?? ""}`.trim(), lines.join("<br/><br/>"), storeEmailBrand(c.store));
    return { sent: true };
  } catch (err) {
    void logError("EMAIL", "Job receipt email failed", { reference, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "send failed" };
  }
}
