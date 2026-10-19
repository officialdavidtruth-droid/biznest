/**
 * The one place money is formatted for display (storefront templates + customer account pages).
 * Uses Intl with the en-NG locale so server and client render identically (no hydration mismatch)
 * and the symbol/grouping come from the currency code: NGN -> ₦5,000, USD -> US$50.
 * Whole amounts show no decimals; amounts with kobo/cents show two.
 */
export const DEFAULT_CURRENCY = "NGN";

export function formatMoney(amount: unknown, currency?: string | null): string {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  const digits = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    // Unknown currency code: never throw while rendering a storefront.
    return `${code} ${value.toLocaleString("en-NG")}`;
  }
}
