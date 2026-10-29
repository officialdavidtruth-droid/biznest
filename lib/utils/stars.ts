/**
 * Star rendering that cannot throw. Review.rating is an Int with no database
 * constraint (the 1-5 range was only a schema comment), so legacy or bad rows
 * can hold 0, 7, -3 or null. String.prototype.repeat throws a RangeError on a
 * negative count, and that error takes down the whole server-rendered page,
 * so every star display goes through these helpers instead of calling
 * "★".repeat(...) on raw data.
 */
export function clampRating(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/** Filled stars for a rating (0-5; anything invalid renders as none). */
export function starFill(value: unknown): string {
  return "★".repeat(clampRating(value));
}

/** The remaining empty stars so filled + empty is always 5. */
export function starEmpty(value: unknown): string {
  return "☆".repeat(5 - clampRating(value));
}
