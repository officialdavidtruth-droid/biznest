/**
 * Pre-order rules (pure — safe on client and server).
 *
 * A pre-order product sells without touching stock: every unit is a pre-order, stock counts are
 * ignored and never decremented. When the goods arrive the merchant switches pre-order off and
 * enters real stock. `limit` (optional) caps total pre-order units; `shipsOn` (optional) is the
 * expected ship date shown to customers — a promise, not an automatic cut-off.
 */
export type PreorderSettings = { enabled: boolean; shipsOn: Date | null; limit: number | null };

/** Orders that still count against the cap: anything not cancelled/refunded. */
export const PREORDER_UNCOUNTED_STATUSES = ["CANCELLED", "REFUNDED"] as const;

export const PREORDER_MAX_LIMIT = 100_000;

export function formatShipsOn(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Units still available to pre-order; null means no cap. */
export function preorderSpotsLeft(limit: number | null, taken: number): number | null {
  return limit == null ? null : Math.max(0, limit - taken);
}

/** Can `asking` more units be pre-ordered given the cap and what's already taken? */
export function canPreorder(limit: number | null, taken: number, asking: number): boolean {
  return limit == null || taken + asking <= limit;
}

/** Validates the merchant's pre-order form. `shipsOn` is "YYYY-MM-DD" or "", `limit` a whole-number string or "". */
export function parsePreorderInput(
  input: { enabled: boolean; shipsOn: string; limit: string },
  now: Date = new Date(),
): { ok: true; data: PreorderSettings } | { ok: false; error: string } {
  if (!input.enabled) return { ok: true, data: { enabled: false, shipsOn: null, limit: null } };
  let shipsOn: Date | null = null;
  if (input.shipsOn.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.shipsOn.trim())) return { ok: false, error: "Enter the ship date as a valid date." };
    shipsOn = new Date(`${input.shipsOn.trim()}T00:00:00Z`);
    if (Number.isNaN(shipsOn.getTime())) return { ok: false, error: "Enter the ship date as a valid date." };
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (shipsOn.getTime() < today) return { ok: false, error: "The expected ship date can't be in the past." };
  }
  let limit: number | null = null;
  if (input.limit.trim()) {
    const n = Number(input.limit.trim());
    if (!Number.isInteger(n) || n < 1 || n > PREORDER_MAX_LIMIT) return { ok: false, error: `The pre-order limit must be a whole number between 1 and ${PREORDER_MAX_LIMIT.toLocaleString("en-NG")}.` };
    limit = n;
  }
  return { ok: true, data: { enabled: true, shipsOn, limit } };
}
