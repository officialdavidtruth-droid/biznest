/**
 * Product/service currency is set per item, but an order has exactly one
 * currency and its totals are plain sums of unit prices. Mixing currencies
 * would add e.g. NGN and USD amounts together and charge the wrong total.
 * Returns the distinct (upper-cased) codes when more than one is present,
 * otherwise null.
 */
export function findMixedCurrencies(codes: Array<string | null | undefined>): string[] | null {
  const distinct = [...new Set(codes.filter((c): c is string => Boolean(c && c.trim())).map((c) => c.trim().toUpperCase()))].sort();
  return distinct.length > 1 ? distinct : null;
}

export function mixedCurrencyMessage(codes: string[]): string {
  return `Items priced in different currencies (${codes.join(" and ")}) can't be bought together. Please check out each currency separately.`;
}
