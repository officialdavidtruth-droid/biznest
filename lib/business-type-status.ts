/**
 * Business types that are listed but not ready for new businesses yet. One list, used by the signup category
 * picker, the validation behind it and the landing page. Businesses that already chose one of these keep working.
 * To launch a niche, delete its name from this list. Names must match lib/capabilities.ts exactly.
 */
export const COMING_SOON_BUSINESS_TYPES: readonly string[] = [];

export function isComingSoonBusinessType(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return COMING_SOON_BUSINESS_TYPES.some((t) => t.toLowerCase() === n);
}

/** The label shown in pickers and lists. */
export function businessTypeLabel(name: string): string {
  return isComingSoonBusinessType(name) ? `${name} (coming soon)` : name;
}
