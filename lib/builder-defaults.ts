import type { BuilderSectionItem } from "@/lib/builder-config";

type Mode = "commerce" | "service" | "hybrid" | string;

/**
 * Starting content for the Features and FAQ builder sections. Used when the owner has not written their own
 * entries yet, and to seed the editor so "Edit these" starts from real text instead of a blank list.
 */
export function defaultFeatureItems(mode: Mode): BuilderSectionItem[] {
  if (mode === "service") return [
    { title: "Experienced team", body: "Work is handled by people who do this every day." },
    { title: "Clear pricing", body: "You know what to expect before you commit." },
    { title: "Easy booking", body: "Pick a service and a time online in a few taps." },
    { title: "Friendly support", body: "Questions before or after? Reach us any time." },
  ];
  return [
    { title: "Quality you can trust", body: "Every item is checked before it reaches you." },
    { title: "Simple online ordering", body: "Browse, add to cart and pay securely in minutes." },
    { title: "Responsive support", body: "Talk to a real person when you need help." },
    { title: "Reliable delivery", body: "Orders are packed with care and kept on track." },
  ];
}

export function defaultFaqItems(mode: Mode, contact?: string | null): BuilderSectionItem[] {
  return [
    mode === "commerce"
      ? { title: "How do I place an order?", body: "Browse the shop, add what you like to your cart and check out. You will get a confirmation straight away." }
      : { title: "How do I book a service?", body: "Choose a service, pick a time that suits you and confirm your booking online." },
    { title: "How can I contact this business?", body: contact || "Use the contact section on this store." },
  ];
}

/** Normalises a store's AI-generated FAQ ({question, answer}) into section items. Ignores anything malformed. */
export function faqFromStoreOverrides(value: unknown): BuilderSectionItem[] {
  if (!Array.isArray(value)) return [];
  const out: BuilderSectionItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const q = String((row as { question?: unknown }).question ?? "").trim();
    const a = String((row as { answer?: unknown }).answer ?? "").trim();
    if (q && a) out.push({ title: q.slice(0, 160), body: a.slice(0, 1200) });
    if (out.length >= 12) break;
  }
  return out;
}

/** Search text for the Map section: the owner's address, else the business location. */
export function mapQuery(address: string | undefined, business: { city?: string | null; state?: string | null; country?: string | null } | null | undefined): string {
  const own = (address ?? "").trim();
  if (own) return own;
  return [business?.city, business?.state, business?.country].map((v) => (v ?? "").trim()).filter(Boolean).join(", ");
}

export function mapEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function mapDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * wa.me link from a stored WhatsApp number. Accepts international digits ("2348012345678", "+234 801 234 5678")
 * or a Nigerian local number starting with 0 ("0801 234 5678"). Returns null when there is nothing usable.
 */
export function whatsappLink(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}
