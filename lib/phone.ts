/**
 * Phone identity helpers. The same Nigerian number is written many ways
 * (0803 123 4567, 08031234567, +2348031234567, 2348031234567). Everything that
 * decides "is this the same person?" must go through phoneKey so POS, Customer
 * 360 and dashboard links agree.
 */

/** Stable matching key, or null when there aren't enough digits to identify anyone. */
export function phoneKey(value: string | null | undefined): string | null {
  if (!value) return null;
  let d = value.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 00234... international prefix
  if (d.length === 13 && d.startsWith("234")) return d.slice(3); // +234 803 123 4567
  if (d.length === 11 && d.startsWith("0")) return d.slice(1); // 0803 123 4567
  return d.length >= 7 ? d : null;
}

/** Nigerian national numbers are 10 digits once the 0 / 234 prefix is removed. */
function isNgKey(key: string) {
  return key.length === 10 && !key.startsWith("0");
}

/** Format to store: +234XXXXXXXXXX for Nigerian numbers, otherwise the trimmed input. */
export function canonicalPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const key = phoneKey(trimmed);
  return key && isNgKey(key) ? `+234${key}` : trimmed;
}

/** Every plain form a stored value might have, for exact database lookups. */
export function phoneVariants(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  const key = phoneKey(trimmed);
  const out = new Set<string>([trimmed]);
  if (key) {
    out.add(key);
    out.add(`+${key}`);
    if (isNgKey(key)) {
      out.add(`0${key}`);
      out.add(`234${key}`);
      out.add(`+234${key}`);
    }
  }
  return [...out];
}

/**
 * Substrings to use with a database `contains` when searching phone columns by
 * what a cashier typed. Stored numbers come in several forms (+234803…, 0803…,
 * 803…) so searching the raw input misses most of them: "0803123" is not a
 * substring of "+2348031234567". The national core (no 0 / 234 prefix) is a
 * substring of every form. Returns [] when the input isn't phone-like, so a
 * name or email search never turns into a phone search.
 */
export function phoneSearchTerms(query: string | null | undefined): string[] {
  const q = query?.trim();
  if (!q || !/^[+\d\s().-]+$/.test(q)) return [];
  let d = q.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  const core = d.startsWith("234") && d.length > 3 ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  const terms = new Set<string>();
  if (core.length >= 3) terms.add(core);
  if (q.length >= 3) terms.add(q); // keeps matching numbers stored exactly as typed (spaces, dashes)
  return [...terms];
}
