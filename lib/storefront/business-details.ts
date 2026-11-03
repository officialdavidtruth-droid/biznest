/**
 * One place that answers "what is this business's phone / email / address / hours?" for every
 * public template. The owner sets these once on the Business details screen; templates call these
 * helpers instead of each reading a different mix of fields.
 *
 * Every helper returns "" when there is nothing to show, so a template's own "not published"
 * wording keeps working.
 */
type Loose = {
  contactPhone?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  email?: string | null;
  address?: string | null;
  openingHours?: string | null;
  business?: { phone?: string | null; email?: string | null; city?: string | null; state?: string | null } | null;
} | null | undefined;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function businessPhone(store: Loose): string {
  return clean(store?.contactPhone) || clean(store?.phone) || clean(store?.business?.phone);
}

export function businessEmail(store: Loose): string {
  return clean(store?.contactEmail) || clean(store?.email) || clean(store?.business?.email);
}

/** The address the owner typed, else "City, State" from the business profile. */
export function businessAddress(store: Loose): string {
  const typed = clean(store?.address);
  if (typed) return typed;
  return [clean(store?.business?.city), clean(store?.business?.state)].filter(Boolean).join(", ");
}

export function businessHours(store: Loose): string {
  return clean(store?.openingHours);
}

export const SOCIAL_KEYS = ["instagram", "facebook", "tiktok", "twitter"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

const SOCIAL_BASE: Record<SocialKey, string> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  tiktok: "https://tiktok.com/@",
  twitter: "https://x.com/",
};

/**
 * Owners paste either a full link or just a handle ("@mybakery"). Returns the full https link,
 * "" when the box was empty, or null when the value can't be turned into a safe link.
 */
export function normalizeSocialLink(key: SocialKey, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) {
    try {
      const url = new URL(v);
      if (url.username || url.password || v.length > 300) return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  const handle = v.replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;
  return `${SOCIAL_BASE[key]}${handle}`;
}
