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
