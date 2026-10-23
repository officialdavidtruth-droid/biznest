/**
 * Click-to-chat (wa.me) helpers. BizNest never sends WhatsApp messages itself:
 * every link opens a chat between the customer and the VENDOR'S OWN number
 * (or, on the dashboard, the vendor's own WhatsApp -> the customer's number).
 *
 * wa.me needs country code + number, digits only (no "+", spaces, dashes or
 * the national leading 0). Vendors and customers type all sorts of formats,
 * so normalise here. Bare local numbers are assumed Nigerian.
 */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith("+");
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (!hadPlus) {
    if (d.startsWith("0") && d.length === 11) d = "234" + d.slice(1);
    else if (d.length === 10 && /^[789]/.test(d)) d = "234" + d;
  }
  // "+234 (0)803 123 4567" leaves a stray 0 after the country code.
  if (d.startsWith("2340") && d.length === 14) d = "234" + d.slice(4);
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

/** wa.me link for a number (or an existing WhatsApp URL), optional prefilled text. Null when unusable. */
export function whatsappLink(raw: string | null | undefined, text?: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      const host = new URL(v).hostname.replace(/^www\./, "");
      if (host === "wa.me" || host.endsWith("whatsapp.com")) return v;
    } catch {}
    return null;
  }
  const n = normalizeWhatsAppNumber(v);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
