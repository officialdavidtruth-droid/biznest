import { logError, errorMeta } from "@/lib/observability/log";

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID ?? "BizNest";
const TERMII_BASE_URL = "https://v3.api.termii.com/api/sms/send";

type SmsResult = { success: true } | { success: false; error: string };

/**
 * Sends a plain-text SMS via Termii (api/sms/send, "generic" channel --
 * no pre-registered template needed, unlike Termii's DND/WhatsApp routes).
 * `to` should be in international format (e.g. 2348012345678); Termii
 * accepts local Nigerian formats too but international avoids ambiguity
 * for stores whose buyers are outside Nigeria.
 *
 * Mirrors lib/email/send.ts's shape: never throws for an API-level
 * rejection, always logs to SystemEvent via the MESSAGING category, and
 * returns a plain success/error result the caller can show to the merchant.
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  if (!TERMII_API_KEY) {
    void logError("MESSAGING", "SMS send skipped: TERMII_API_KEY not configured", { to });
    return { success: false, error: "SMS is not configured for this platform yet." };
  }

  try {
    const res = await fetch(TERMII_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to,
        from: TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });

    const data = await res.json().catch(() => null);

    // Termii returns 200 with a message_id on success; failures come back
    // either as a non-2xx status or a 200 with an error message/code field.
    if (!res.ok || !data || data.message_id === undefined) {
      const reason = data?.message ?? `Termii responded with status ${res.status}`;
      void logError("MESSAGING", "SMS send failed", { to, reason });
      return { success: false, error: reason };
    }

    return { success: true };
  } catch (err) {
    void logError("MESSAGING", "SMS send threw", errorMeta(err, { to }));
    return { success: false, error: "Couldn't reach the SMS provider — try again shortly." };
  }
}
