/**
 * Pure helpers for job cards: niche profiles and stages, pricing, deposit splits and validation.
 * No database or Next.js imports so they are easy to test.
 */
import { money, newPortalToken, lastReceiptSeq, receiptNumber } from "@/lib/real-estate";

export { money, lastReceiptSeq, receiptNumber };
export const newJobToken = newPortalToken;

export const JOB_PAY_PREFIX = "JBC";
export const JOB_MIN_ONLINE_PAYMENT = 100;
export const JOB_PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "POS", "OTHER"] as const;
export const ITEM_KINDS = ["LABOUR", "PARTS", "MATERIALS", "FEE", "OTHER"] as const;

export type Niche = "AUTO" | "CLEANING" | "CONSTRUCTION" | "PHOTOGRAPHY";
export const NICHES: Niche[] = ["AUTO", "CLEANING", "CONSTRUCTION", "PHOTOGRAPHY"];
export const isNiche = (v: unknown): v is Niche => typeof v === "string" && (NICHES as string[]).includes(v);

export type NicheProfile = {
  niche: Niche; label: string; subjectLabel: string; subjectPlaceholder: string; detailLabel: string; detailPlaceholder: string;
  stages: { key: string; label: string }[]; itemKinds: string[]; deliverableLabel: string | null; defaultDepositPct: number;
};

export const PROFILES: Record<Niche, NicheProfile> = {
  AUTO: {
    niche: "AUTO", label: "Auto repair", subjectLabel: "Registration", subjectPlaceholder: "e.g. ABC-123-XY", detailLabel: "Make, model, year", detailPlaceholder: "e.g. Toyota Corolla 2012",
    stages: [{ key: "BOOKED_IN", label: "Booked in" }, { key: "DIAGNOSING", label: "Diagnosing" }, { key: "AWAITING_APPROVAL", label: "Waiting for your approval" }, { key: "IN_REPAIR", label: "Being repaired" }, { key: "READY", label: "Ready for collection" }, { key: "COLLECTED", label: "Collected" }],
    itemKinds: ["LABOUR", "PARTS", "OTHER"], deliverableLabel: null, defaultDepositPct: 0,
  },
  CLEANING: {
    niche: "CLEANING", label: "Cleaning", subjectLabel: "Address", subjectPlaceholder: "Where is the job?", detailLabel: "Type of clean", detailPlaceholder: "e.g. Deep clean, 3-bed flat",
    stages: [{ key: "SCHEDULED", label: "Scheduled" }, { key: "ON_SITE", label: "Team on site" }, { key: "DONE", label: "Cleaning done" }, { key: "SIGNED_OFF", label: "Signed off" }],
    itemKinds: ["LABOUR", "MATERIALS", "FEE", "OTHER"], deliverableLabel: null, defaultDepositPct: 0,
  },
  CONSTRUCTION: {
    niche: "CONSTRUCTION", label: "Construction", subjectLabel: "Site address", subjectPlaceholder: "Where is the site?", detailLabel: "Scope", detailPlaceholder: "e.g. Bathroom renovation",
    stages: [{ key: "QUOTED", label: "Quoted" }, { key: "MOBILISING", label: "Mobilising" }, { key: "IN_PROGRESS", label: "Work in progress" }, { key: "SNAGGING", label: "Snagging" }, { key: "COMPLETED", label: "Completed" }],
    itemKinds: ["LABOUR", "MATERIALS", "FEE", "OTHER"], deliverableLabel: "Handover pack", defaultDepositPct: 50,
  },
  PHOTOGRAPHY: {
    niche: "PHOTOGRAPHY", label: "Photography", subjectLabel: "Location", subjectPlaceholder: "Where is the shoot?", detailLabel: "Shoot type", detailPlaceholder: "e.g. Wedding, 8 hours",
    stages: [{ key: "BOOKED", label: "Booked" }, { key: "SHOT", label: "Shoot done" }, { key: "EDITING", label: "Editing" }, { key: "PROOFS", label: "Proofs ready" }, { key: "DELIVERED", label: "Delivered" }],
    itemKinds: ["LABOUR", "FEE", "OTHER"], deliverableLabel: "Final gallery", defaultDepositPct: 50,
  },
};

/** The niche a store most likely wants, from its business type and category. Staff can still pick per job. */
export function defaultNiche(businessType: string | null | undefined, category?: string | null): Niche {
  const t = `${businessType ?? ""} ${category ?? ""}`.toLowerCase();
  if (/photo|video|film/.test(t)) return "PHOTOGRAPHY";
  if (/clean|laundry|janitor|fumigat/.test(t)) return "CLEANING";
  if (/construct|build|contractor|renovat|plumb|electric/.test(t)) return "CONSTRUCTION";
  return "AUTO";
}

export const profileFor = (niche: string): NicheProfile => PROFILES[isNiche(niche) ? niche : "AUTO"];
export const firstStage = (niche: Niche) => PROFILES[niche].stages[0].key;
export const lastStage = (niche: Niche) => PROFILES[niche].stages[PROFILES[niche].stages.length - 1].key;
export const isStage = (niche: Niche, stage: unknown) => typeof stage === "string" && PROFILES[niche].stages.some((s) => s.key === stage);
export const stageLabel = (niche: string, stage: string) => profileFor(niche).stages.find((s) => s.key === stage)?.label ?? stage;

/** 0-100 progress through the niche's stages. */
export function progressPct(niche: string, stage: string): number {
  const st = profileFor(niche).stages;
  const i = st.findIndex((s) => s.key === stage);
  if (i < 0 || st.length < 2) return 0;
  return Math.round((i / (st.length - 1)) * 100);
}

export const jobNumber = (seq: number) => `JOB-${String(seq).padStart(5, "0")}`;
export function lastJobSeq(nos: (string | null | undefined)[]): number {
  let max = 0;
  for (const n of nos) { const m = /^JOB-(\d+)$/.exec(n ?? ""); if (m) max = Math.max(max, Number(m[1])); }
  return max;
}

export type ItemLike = { qty: number; unitPrice: number | string };
export function itemsTotal(items: ItemLike[]): number {
  let t = 0;
  for (const i of items) t += Math.max(0, Math.floor(Number(i.qty)) || 0) * (Number(i.unitPrice) || 0);
  return Math.round(t * 100) / 100;
}

/** Splits a total into a deposit and a balance. Both sum exactly to the total; 0% or 100% give a single charge. */
export function splitCharges(total: number, depositPct: number): { label: string; amount: number }[] {
  const t = Math.round(total * 100) / 100;
  if (!(t > 0)) return [];
  const pct = Math.min(Math.max(Math.round(depositPct), 0), 100);
  if (pct === 0 || pct === 100) return [{ label: pct === 100 ? "Full payment" : "Payment", amount: t }];
  const deposit = Math.round(t * pct) / 100;
  const balance = Math.round((t - deposit) * 100) / 100;
  return [{ label: `Deposit (${pct}%)`, amount: deposit }, { label: "Balance", amount: balance }];
}

export type ChargeLike = { status: string; amount: number | string | { toString(): string } };
export function outstanding(charges: ChargeLike[]): number {
  return Math.round(charges.filter((c) => c.status === "DUE").reduce((s, c) => s + Number(c.amount), 0) * 100) / 100;
}
/** The final deliverable (gallery, handover pack) is shown once something has been billed and nothing is still owing. */
export function deliverableVisible(charges: ChargeLike[]): boolean {
  const live = charges.filter((c) => c.status !== "VOID");
  return live.length === 0 || live.every((c) => c.status === "PAID");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type JobInput = { niche?: unknown; title?: unknown; customerName?: unknown; customerPhone?: unknown; customerEmail?: unknown; subject?: unknown; subjectDetail?: unknown; scheduledFor?: unknown };

export function sanitizeJobCard(input: JobInput): { ok: true; job: { niche: Niche; title: string; customerName: string; customerPhone: string | null; customerEmail: string | null; subject: string | null; subjectDetail: string | null; scheduledFor: Date | null } } | { ok: false; error: string } {
  if (!isNiche(input.niche)) return { ok: false, error: "Choose the type of job." };
  const customerName = String(input.customerName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!customerName) return { ok: false, error: "Enter the customer's name." };
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || PROFILES[input.niche].label;
  const email = String(input.customerEmail ?? "").trim().toLowerCase();
  if (email && (email.length > 160 || !EMAIL_RE.test(email))) return { ok: false, error: "That email address doesn't look right." };
  const phoneRaw = String(input.customerPhone ?? "").trim();
  const digits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && (digits.length < 7 || digits.length > 15)) return { ok: false, error: "That phone number doesn't look right." };
  let scheduledFor: Date | null = null;
  if (input.scheduledFor) { scheduledFor = new Date(String(input.scheduledFor)); if (Number.isNaN(scheduledFor.getTime())) return { ok: false, error: "That date doesn't look right." }; }
  return { ok: true, job: { niche: input.niche, title, customerName, customerPhone: phoneRaw ? phoneRaw.replace(/[^\d+]/g, "").slice(0, 20) : null, customerEmail: email || null, subject: String(input.subject ?? "").trim().slice(0, 200) || null, subjectDetail: String(input.subjectDetail ?? "").trim().slice(0, 200) || null, scheduledFor } };
}

export function sanitizeItem(input: { kind?: unknown; label?: unknown; qty?: unknown; unitPrice?: unknown }): { ok: true; item: { kind: string; label: string; qty: number; unitPrice: number } } | { ok: false; error: string } {
  const label = String(input.label ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!label) return { ok: false, error: "Describe the item." };
  const qty = Math.floor(Number(input.qty ?? 1));
  if (!Number.isFinite(qty) || qty < 1 || qty > 10_000) return { ok: false, error: "Enter a quantity of 1 or more." };
  const price = money(input.unitPrice);
  if (!Number.isFinite(price) || price < 0 || price > 100_000_000) return { ok: false, error: "Enter a valid price." };
  const kind = (ITEM_KINDS as readonly string[]).includes(String(input.kind)) ? String(input.kind) : "OTHER";
  return { ok: true, item: { kind, label, qty, unitPrice: price } };
}

export function safeHttpsUrl(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString().slice(0, 500) : null; } catch { return null; }
}

export const jobPagePath = (slug: string, token: string) => `/store/${slug}/job/${token}`;
