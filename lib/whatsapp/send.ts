import { logError, errorMeta } from "@/lib/observability/log";

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_VERSION = "v20.0";

type WhatsAppResult = { success: true } | { success: false; error: string };

/**
 * Sends a WhatsApp message via Meta's WhatsApp Business Cloud API.
 *
 * Meta only allows free-form text to a customer inside the 24h "session"
 * window opened by them messaging the business first. An abandoned-checkout
 * nudge is merchant-initiated, so outside that window it MUST go as an
 * approved message template rather than free text -- sending plain text
 * here would just be silently rejected by Meta once the window has closed.
 * `templateName` should be a template already approved in WhatsApp Manager
 * (e.g. "abandoned_checkout_recovery") with body variables matching
 * `templateParams`, in order. Pass templateName undefined only for testing
 * against numbers inside an open session.
 */
export async function sendWhatsAppMessage(
  to: string,
  params: { body: string } | { templateName: string; templateParams: string[]; languageCode?: string }
): Promise<WhatsAppResult> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    void logError("MESSAGING", "WhatsApp send skipped: credentials not configured", { to });
    return { success: false, error: "WhatsApp is not configured for this platform yet." };
  }

  const payload =
    "templateName" in params
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode ?? "en" },
            components: [
              {
                type: "body",
                parameters: params.templateParams.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: params.body },
        };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.messages?.[0]?.id) {
      const reason = data?.error?.message ?? `WhatsApp API responded with status ${res.status}`;
      void logError("MESSAGING", "WhatsApp send failed", { to, reason });
      return { success: false, error: reason };
    }

    return { success: true };
  } catch (err) {
    void logError("MESSAGING", "WhatsApp send threw", errorMeta(err, { to }));
    return { success: false, error: "Couldn't reach WhatsApp — try again shortly." };
  }
}
