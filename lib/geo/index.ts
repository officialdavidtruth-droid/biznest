import { COUNTRIES } from "@/lib/geo/countries";

export { COUNTRIES };
export const DEFAULT_COUNTRY = "Nigeria";

export function getCountryByName(name?: string | null) {
  if (!name) return null;
  return COUNTRIES.find((c) => c.name === name) ?? null;
}

export function isValidCountry(name?: string | null): boolean {
  return getCountryByName(name) !== null;
}

/** States/regions of a country (by display name). Empty array = the country has no list, so free text is accepted. */
export async function getStatesForCountry(countryName?: string | null): Promise<string[]> {
  const country = getCountryByName(countryName);
  if (!country) return [];
  const { STATES_BY_COUNTRY } = await import("@/lib/geo/states-data");
  return STATES_BY_COUNTRY[country.code] ?? [];
}

/** Server-side check: a state must be in the country's list when the country has one. */
export async function isValidStateForCountry(countryName?: string | null, state?: string | null): Promise<boolean> {
  if (!state?.trim()) return false;
  const states = await getStatesForCountry(countryName);
  return states.length === 0 || states.includes(state);
}

export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
