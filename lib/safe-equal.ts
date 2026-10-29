import crypto from "crypto";

/**
 * Constant-time, case-insensitive comparison for emails (and similar secrets
 * of unequal length). Both sides are hashed first so timingSafeEqual always
 * sees equal-length buffers and the length of the real value isn't leaked.
 */
export function safeEqualEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash("sha256").update(a.trim().toLowerCase()).digest();
  const hb = crypto.createHash("sha256").update(b.trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(ha, hb);
}
