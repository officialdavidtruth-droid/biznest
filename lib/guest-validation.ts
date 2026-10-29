/**
 * Single source of truth for validating anonymous (guest) booking input,
 * shared by createBooking and createStayBooking so the two flows can't drift.
 * Server actions are callable directly, so nothing here trusts client types.
 */

export const GUEST_INPUT_LIMITS = {
  name: 100,
  email: 254,
  notes: 2000,
  phoneMinDigits: 7,
  phoneMaxDigits: 15,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_GUEST = "Please provide a valid name, email and phone number.";

export type NormalizedGuest = { name: string; email: string; phone: string };
export type GuestValidation = { ok: true; guest: NormalizedGuest } | { ok: false; error: string };

/** "+234 (801) 234-5678" -> "+2348012345678"; null when it isn't a plausible number. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  // Only digits, spaces, dashes, dots, parentheses and one leading "+".
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < GUEST_INPUT_LIMITS.phoneMinDigits || digits.length > GUEST_INPUT_LIMITS.phoneMaxDigits) return null;
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}

export function validateGuest(input: { name?: unknown; email?: unknown; phone?: unknown } | null | undefined): GuestValidation {
  if (!input) return { ok: false, error: "Enter your name, email and phone to book as a guest." };
  if (typeof input.name !== "string" || typeof input.email !== "string") return { ok: false, error: INVALID_GUEST };

  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);

  if (!name || name.length > GUEST_INPUT_LIMITS.name) return { ok: false, error: INVALID_GUEST };
  if (!email || email.length > GUEST_INPUT_LIMITS.email || !EMAIL_RE.test(email)) return { ok: false, error: INVALID_GUEST };
  if (!phone) return { ok: false, error: INVALID_GUEST };

  return { ok: true, guest: { name, email, phone } };
}

/** Caps free-text notes. Returns null when over the limit or not a string. */
export function validateNotes(notes: unknown): { ok: true } | { ok: false; error: string } {
  if (notes == null || notes === "") return { ok: true };
  if (typeof notes !== "string" || notes.length > GUEST_INPUT_LIMITS.notes) {
    return { ok: false, error: `Notes can be at most ${GUEST_INPUT_LIMITS.notes} characters.` };
  }
  return { ok: true };
}
