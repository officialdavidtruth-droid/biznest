import "server-only";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { sendSms } from "@/lib/sms/send";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import { formatMoney } from "@/lib/utils/format-money";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, errorMeta } from "@/lib/observability/log";
import { TAILORING_STAGE_BLURB, isTailoringStage, tailoringBalance, tailoringStatusPath } from "@/lib/tailoring";

export type TailoringNotifyOutcome =
  | { sent: true; channel: "WHATSAPP" | "SMS" }
  | { sent: false; reason: "disabled" | "no_phone" | "bad_phone" | "not_found" | "throttled" | "not_configured" | "failed"; detail?: string };

/** Human-readable line for the dashboard after a stage change. */
export function describeNotifyOutcome(o: TailoringNotifyOutcome): string | null {
  if (o.sent) return o.channel === "WHATSAPP" ? "Customer notified on WhatsApp." : "Customer notified by SMS.";
  switch (o.reason) {
    case "no_phone": return "No phone number on this job, so no automatic message was sent.";
    case "bad_phone": return "The customer's phone number looks invalid, so no automatic message was sent.";
    case "throttled": return "A message for this job was just sent, so this one was skipped.";
    case "not_configured": return "Automatic messages aren't set up on the platform yet. Use Send update.";
    case "failed": return `Couldn't message the customer automatically${o.detail ? ` (${o.detail})` : ""}. Use Send update.`;
    default: return null; // disabled / not_found: stay quiet
  }
}

/**
 * Messages the customer that their job moved to a new stage: WhatsApp first, SMS as the fallback.
 * Runs only when the store has switched "automatic updates" on. Never throws.
 *
 * Meta only lets a business start a WhatsApp conversation with an approved template, so set
 * WHATSAPP_TAILORING_TEMPLATE to a template with four body variables:
 *   {{1}} customer first name, {{2}} garment and job number, {{3}} what the new stage means, {{4}} status link.
 * Without it, WhatsApp is tried as plain text (works only inside an open 24h chat) and SMS covers the rest.
 */
export async function notifyTailoringStage(jobId: string): Promise<TailoringNotifyOutcome> {
  try {
    const job = await prisma.tailoringJob.findUnique({
      where: { id: jobId },
      include: { store: { select: { id: true, name: true, slug: true, customDomain: true, customDomainStatus: true, currency: true, tailoringAutoNotify: true } } },
    });
    if (!job) return { sent: false, reason: "not_found" };
    if (!job.store.tailoringAutoNotify) return { sent: false, reason: "disabled" };
    if (!job.customerPhone) return { sent: false, reason: "no_phone" };
    const to = normalizeWhatsAppNumber(job.customerPhone);
    if (!to) return { sent: false, reason: "bad_phone" };
    if (!isTailoringStage(job.stage)) return { sent: false, reason: "not_found" };

    // Someone flicking through stages shouldn't spam the customer (or run up the SMS bill).
    const rate = await checkRateLimit(`tailoring-notify:${job.id}`, 4, 60 * 60 * 1000);
    if (!rate.allowed) return { sent: false, reason: "throttled" };

    const first = job.customerName.trim().split(/\s+/)[0] || "there";
    const link = buildStoreUrl(job.store, `/tailoring/${job.trackingToken}`);
    const balance = tailoringBalance(job.price == null ? null : Number(job.price), Number(job.amountPaid));
    const blurb = `${TAILORING_STAGE_BLURB[job.stage]}${balance && balance > 0 ? ` Balance due: ${formatMoney(balance, job.store.currency)}.` : ""}`;
    const what = `${job.garmentType} (${job.jobNo})`;

    const template = process.env.WHATSAPP_TAILORING_TEMPLATE?.trim();
    const wa = await sendWhatsAppMessage(
      to,
      template
        ? { templateName: template, templateParams: [first, what, blurb, link] }
        : { body: `Hi ${first}, update on your ${what} from ${job.store.name}: ${blurb} Track it here: ${link}` }
    );
    if (wa.success) return { sent: true, channel: "WHATSAPP" };

    const sms = await sendSms(to, `${job.store.name}: Hi ${first}, your ${what} update. ${blurb} Track: ${link}`);
    if (sms.success) return { sent: true, channel: "SMS" };

    const unconfigured = /not configured/i.test(wa.error) && /not configured/i.test(sms.error);
    return unconfigured ? { sent: false, reason: "not_configured" } : { sent: false, reason: "failed", detail: sms.error };
  } catch (err) {
    void logError("MESSAGING", "Tailoring stage notification threw", errorMeta(err, { jobId }));
    return { sent: false, reason: "failed" };
  }
}
