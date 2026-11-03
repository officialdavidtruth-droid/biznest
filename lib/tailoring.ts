/** Shared constants for the Fashion & Tailoring workspace (kept out of "use server" files). */
export const TAILORING_STAGES = [
  { id: "MEASUREMENTS", label: "Measurements" },
  { id: "CUTTING", label: "Cutting" },
  { id: "SEWING", label: "Sewing" },
  { id: "FITTING", label: "Fitting" },
  { id: "READY", label: "Ready" },
  { id: "DELIVERED", label: "Delivered" },
] as const;

export type TailoringStage = (typeof TAILORING_STAGES)[number]["id"];

export const MEASUREMENT_FIELDS = [
  { id: "neck", label: "Neck" }, { id: "shoulder", label: "Shoulder" }, { id: "chest", label: "Chest" },
  { id: "waist", label: "Waist" }, { id: "hip", label: "Hip" }, { id: "sleeve", label: "Sleeve" },
  { id: "length", label: "Length" }, { id: "inseam", label: "Inseam" },
] as const;

export type TailoringMeasurements = { unit: "in" | "cm"; values: Record<string, number> };
export type TailoringFabric = { description?: string; yards?: number };

export const isTailoringStage = (s: string): s is TailoringStage => TAILORING_STAGES.some((x) => x.id === s);

/** Balance still owed on a job (never negative). Null when no price has been set. */
export function tailoringBalance(price: number | null | undefined, paid: number | null | undefined): number | null {
  if (price == null) return null;
  return Math.max(0, Math.round((price - (paid ?? 0)) * 100) / 100);
}

/** The status page link is built from these parts, so the dashboard and the public route can't drift apart. */
export const tailoringStatusPath = (slug: string, token: string) => `/store/${slug}/tailoring/${token}`;
export const isTailoringToken = (t: string) => /^[a-f0-9]{32}$/.test(t);

/** Customer-facing wording for each stage (used on the status page and the WhatsApp message). */
export const TAILORING_STAGE_BLURB: Record<TailoringStage, string> = {
  MEASUREMENTS: "We've taken your measurements and are getting started.",
  CUTTING: "Your fabric is being cut.",
  SEWING: "Your outfit is being sewn.",
  FITTING: "It's ready for a fitting. Please come in to try it on.",
  READY: "Your outfit is ready for pickup.",
  DELIVERED: "Delivered. Thank you for choosing us!",
};

/** Gateway references for a job balance paid from the status page: TLR-<jobId>-<token>. */
export const TAILORING_PAY_PREFIX = "TLR";

/** The storefront order form. Public, no sign-in. */
export const tailoringOrderFormPath = (slug: string) => `/store/${slug}/order-request`;

/** Cheapest online payment worth taking (gateways reject tiny charges). */
export const TAILORING_MIN_ONLINE_PAYMENT = 100;

/**
 * Photos on a job. "reference" = the customer's style picture or a fabric swatch (staff only).
 * "progress" = work in progress, which the customer sees on their status page.
 */
export const TAILORING_PHOTO_KINDS = ["reference", "progress"] as const;
export type TailoringPhotoKind = (typeof TAILORING_PHOTO_KINDS)[number];
export type TailoringPhoto = { url: string; kind: TailoringPhotoKind; caption?: string; at: string };
export const MAX_TAILORING_PHOTOS = 12;

/** Only Cloudinary-hosted https images are accepted, so a photo field can't smuggle in arbitrary links. */
export const isTailoringPhotoUrl = (u: unknown): u is string => {
  if (typeof u !== "string" || u.length > 600) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch { return false; }
};

/** Reads the photos JSON column defensively (it is user-shaped data). */
export function parseTailoringPhotos(raw: unknown): TailoringPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: TailoringPhoto[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const { url, kind, caption, at } = p as Record<string, unknown>;
    if (!isTailoringPhotoUrl(url)) continue;
    out.push({
      url,
      kind: kind === "progress" ? "progress" : "reference",
      caption: typeof caption === "string" && caption.trim() ? caption.trim().slice(0, 140) : undefined,
      at: typeof at === "string" ? at : new Date(0).toISOString(),
    });
  }
  return out.slice(0, MAX_TAILORING_PHOTOS);
}

export type TailoringRequestStatus = "NEW" | "CONVERTED" | "DISMISSED";
