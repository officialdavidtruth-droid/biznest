/**
 * Server-side validation for invoice and quote input. The forms check some of this,
 * but server actions can be called directly, so the server must not trust them.
 * Pure functions: no Prisma, no auth.
 */

// Largest value a Decimal(12,2) column can hold.
export const MAX_AMOUNT = 9_999_999_999.99;
export const MAX_LINES = 100;
export const MAX_QUANTITY = 100_000;

export type LineInput = { description: string; quantity: number; unitPrice: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT;
}

/** Returns an error message, or null when the lines are valid. */
export function validateLines(items: LineInput[]): string | null {
  if (!Array.isArray(items) || items.length === 0) return "Add at least one line item.";
  if (items.length > MAX_LINES) return `A document can have at most ${MAX_LINES} line items.`;
  for (const item of items) {
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!description) return "Every line item needs a description.";
    if (description.length > 300) return "Line item descriptions can be at most 300 characters.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return "Quantity must be a whole number of at least 1.";
    }
    if (!isMoney(item.unitPrice)) return "Unit price must be a number that is not negative.";
  }
  return null;
}

/** Trims descriptions; call after validateLines passes. */
export function cleanLines(items: LineInput[]): LineInput[] {
  return items.map((i) => ({ description: i.description.trim(), quantity: i.quantity, unitPrice: i.unitPrice }));
}

/** For optional amounts such as tax, discount, delivery fee and deposit. undefined/null are fine. */
export function validateOptionalAmount(label: string, value: number | null | undefined): string | null {
  if (value == null) return null;
  return isMoney(value) ? null : `${label} must be a number that is not negative.`;
}

export function validateContact(input: { customerName?: string; customerEmail?: string; customerPhone?: string }): string | null {
  if (input.customerName && input.customerName.length > 120) return "Customer name is too long.";
  if (input.customerEmail && (input.customerEmail.length > 254 || !EMAIL_RE.test(input.customerEmail))) return "Enter a valid customer email address.";
  if (input.customerPhone && input.customerPhone.length > 30) return "Customer phone number is too long.";
  return null;
}

/** An ISO date string that actually parses, or null when none was given. */
export function parseOptionalDate(value: string | undefined): { ok: true; date: Date | null } | { ok: false } {
  if (!value) return { ok: true, date: null };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, date };
}
