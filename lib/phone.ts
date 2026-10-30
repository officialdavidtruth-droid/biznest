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
