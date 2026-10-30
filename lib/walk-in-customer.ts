/**
 * Internal email of the shared "Walk-in customer" user that anonymous POS sales
 * are attached to (one per store). Customer 360 uses this to keep those sales
 * out of the customer list, and POS uses it to find/create the user.
 */
export function walkInEmail(storeId: string): string {
  return `pos-walkin-${storeId}@biznest.internal`;
}
