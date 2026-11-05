import "server-only";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { sendSms } from "@/lib/sms/send";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, errorMeta } from "@/lib/observability/log";

/**
 * Master switch for automatic WhatsApp/SMS customer messages. OFF unless CUSTOMER_MESSAGING_ENABLED=true,
 * so the feature can be shipped dormant and turned on later by setting that one variable (plus the
 * Termii / WhatsApp keys). Read at call time, not import time.
 */
export function customerMessagingEnabled(): boolean {
  return process.env.CUSTOMER_MESSAGING_ENABLED === "true";
}

export type CustomerMessageOutcome =
  | { sent: true; channel: "WHATSAPP" | "SMS" }
  | { sent: false; reason: "no_phone" | "bad_phone" | "throttled" | "not_configured" | "failed"; detail?: string };

/**
 * Messages a customer about their order/booking: WhatsApp first, SMS as the fallback (same approach as
 * the tailoring updates). Callers must already have checked that the store opted in. Never throws.
 *
 * WhatsApp only lets a business start a chat with an APPROVED TEMPLATE, so set WHATSAPP_CUSTOMER_TEMPLATE to
 * a template with three body variables: {{1}} customer first name, {{2}} store name, {{3}} the message.
 * Without it WhatsApp is tried as plain text (works only inside an open 24h chat) and SMS covers the rest.
 * Meta also forbids newlines in template variables, so the message is flattened to one line.
 *
 * `dedupeKey` + `perHour` bound how many messages one thing (an order, a booking) can trigger, so a merchant
 * flicking through statuses can't spam a customer or run up the SMS bill.
 */
export async function messageCustomer(args: {
  phone: string | null | undefined;
  firstName?: string | null;
  storeName: string;
  text: string;
  dedupeKey: string;
  perHour?: number;
}): Promise<CustomerMessageOutcome> {
  try {
    if (!customerMessagingEnabled()) return { sent: false, reason: "not_configured" };
    if (!args.phone) return { sent: false, reason: "no_phone" };
    const to = normalizeWhatsAppNumber(args.phone);
    if (!to) return { sent: false, reason: "bad_phone" };

    const rate = await checkRateLimit(`customer-msg:${args.dedupeKey}`, args.perHour ?? 6, 60 * 60 * 1000);
    if (!rate.allowed) return { sent: false, reason: "throttled" };

    const first = (args.firstName ?? "").trim().split(/\s+/)[0] || "there";
    const flat = args.text.replace(/\s+/g, " ").trim();

    const template = process.env.WHATSAPP_CUSTOMER_TEMPLATE?.trim();
    const wa = await sendWhatsAppMessage(
      to,
      template
        ? { templateName: template, templateParams: [first, args.storeName, flat] }
        : { body: `Hi ${first}, ${flat}` }
    );
    if (wa.success) return { sent: true, channel: "WHATSAPP" };

    const sms = await sendSms(to, `${args.storeName}: ${flat}`);
    if (sms.success) return { sent: true, channel: "SMS" };

    const unconfigured = /not configured/i.test(wa.error) && /not configured/i.test(sms.error);
    return unconfigured ? { sent: false, reason: "not_configured" } : { sent: false, reason: "failed", detail: sms.error };
  } catch (err) {
    void logError("MESSAGING", "Customer message threw", errorMeta(err, { dedupeKey: args.dedupeKey }));
    return { sent: false, reason: "failed" };
  }
}
