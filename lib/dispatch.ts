/**
 * Pure helpers for logistics dispatch: statuses and allowed moves, job numbers, delivery PIN, validation and rider cash.
 * No database or Next.js imports so they are easy to test.
 */
import { money, newPortalToken } from "@/lib/real-estate";

export { money };
export const newDispatchToken = newPortalToken;

export const DELIVERY_STATUSES = ["NEW", "ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED", "CANCELLED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const STATUS_LABEL: Record<DeliveryStatus, string> = { NEW: "Waiting for a rider", ASSIGNED: "Rider assigned", PICKED_UP: "On the way", DELIVERED: "Delivered", FAILED: "Delivery failed", CANCELLED: "Cancelled" };
export const isDeliveryStatus = (v: unknown): v is DeliveryStatus => typeof v === "string" && (DELIVERY_STATUSES as readonly string[]).includes(v);

export const statusLabel = (s: string): string => (isDeliveryStatus(s) ? STATUS_LABEL[s] : s);

const MOVES: Record<DeliveryStatus, DeliveryStatus[]> = {
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "NEW", "CANCELLED", "FAILED"],
  PICKED_UP: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["NEW"], // can be sent out again
  CANCELLED: [],
};
export const canMove = (from: string, to: string) => isDeliveryStatus(from) && isDeliveryStatus(to) && MOVES[from].includes(to);
export const isOpen = (status: string) => status === "NEW" || status === "ASSIGNED" || status === "PICKED_UP";

/** "DLV-00042" from a sequence number. */
export const jobNumber = (seq: number) => `DLV-${String(seq).padStart(5, "0")}`;
export function lastJobSeq(jobNos: (string | null | undefined)[]): number {
  let max = 0;
  for (const j of jobNos) { const m = /^DLV-(\d+)$/.exec(j ?? ""); if (m) max = Math.max(max, Number(m[1])); }
  return max;
}

/** A 4-digit delivery PIN from the platform CSPRNG. The customer reads it to the rider at the door. */
export function newDeliveryPin(): string {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return String(a[0] % 10000).padStart(4, "0");
}
export const pinMatches = (expected: string, given: unknown) => typeof given === "string" && /^\d{4}$/.test(given.trim()) && given.trim() === expected;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanPhone = (v: unknown): { ok: true; value: string | null } | { ok: false } => {
  const raw = String(v ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return { ok: false };
  return { ok: true, value: raw.replace(/[^\d+]/g, "").slice(0, 20) };
};

export type JobInput = { customerName?: unknown; customerPhone?: unknown; customerEmail?: unknown; pickupAddress?: unknown; pickupContact?: unknown; dropoffAddress?: unknown; dropoffContact?: unknown; itemDescription?: unknown; fee?: unknown; codAmount?: unknown };
export type CleanJob = {
  customerName: string; customerPhone: string | null; customerEmail: string | null; pickupAddress: string; pickupContact: string | null;
  dropoffAddress: string; dropoffContact: string | null; itemDescription: string | null; fee: number; codAmount: number;
};

export function sanitizeJob(input: JobInput): { ok: true; job: CleanJob } | { ok: false; error: string } {
  const customerName = String(input.customerName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!customerName) return { ok: false, error: "Enter the customer's name." };
  const pickupAddress = String(input.pickupAddress ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const dropoffAddress = String(input.dropoffAddress ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!pickupAddress) return { ok: false, error: "Enter the pickup address." };
  if (!dropoffAddress) return { ok: false, error: "Enter the delivery address." };
  const phone = cleanPhone(input.customerPhone); if (!phone.ok) return { ok: false, error: "That customer phone number doesn't look right." };
  const pc = cleanPhone(input.pickupContact); if (!pc.ok) return { ok: false, error: "That pickup phone number doesn't look right." };
  const dc = cleanPhone(input.dropoffContact); if (!dc.ok) return { ok: false, error: "That recipient phone number doesn't look right." };
  const email = String(input.customerEmail ?? "").trim().toLowerCase();
  if (email && (email.length > 160 || !EMAIL_RE.test(email))) return { ok: false, error: "That email address doesn't look right." };
  const fee = money(input.fee ?? 0), cod = money(input.codAmount ?? 0);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100_000_000) return { ok: false, error: "Enter a valid delivery fee." };
  if (!Number.isFinite(cod) || cod < 0 || cod > 100_000_000) return { ok: false, error: "Enter a valid cash-on-delivery amount." };
  return { ok: true, job: { customerName, customerPhone: phone.value, customerEmail: email || null, pickupAddress, pickupContact: pc.value, dropoffAddress, dropoffContact: dc.value, itemDescription: String(input.itemDescription ?? "").trim().slice(0, 300) || null, fee, codAmount: cod } };
}

export type CashRow = { riderId: string | null; status: string; codAmount: number | string; codRemittedAt: Date | string | null };
/** Cash riders are holding: delivered cash-on-delivery jobs not yet handed in, per rider. */
export function riderCashOwed(rows: CashRow[]): Map<string, { owed: number; jobs: number }> {
  const out = new Map<string, { owed: number; jobs: number }>();
  for (const r of rows) {
    const amt = Number(r.codAmount);
    if (!r.riderId || r.status !== "DELIVERED" || r.codRemittedAt || !(amt > 0)) continue;
    const cur = out.get(r.riderId) ?? { owed: 0, jobs: 0 };
    cur.owed = Math.round((cur.owed + amt) * 100) / 100; cur.jobs += 1;
    out.set(r.riderId, cur);
  }
  return out;
}

export const riderPath = (slug: string, token: string) => `/store/${slug}/rider/${token}`;
export const trackPath = (slug: string, token: string) => `/store/${slug}/track/${token}`;
