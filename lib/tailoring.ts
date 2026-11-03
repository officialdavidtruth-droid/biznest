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
