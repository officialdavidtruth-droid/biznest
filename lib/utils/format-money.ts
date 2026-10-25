import { DEFAULT_LOCALE, resolveLocale } from "@/lib/i18n/locale";

/**
 * The one place money is formatted for display (storefront templates, dashboards, emails).
 * The symbol comes from the currency code (NGN -> ₦5,000) and grouping from the locale.
 * The locale defaults to the deployment default (en-NG) so server and client render identically
 * (no hydration mismatch); pass `locale` to render for a customer or store in another market.
 * By default whole amounts show no decimals and amounts with kobo/cents show two.
 */
export const DEFAULT_CURRENCY = "NGN";
export { DEFAULT_LOCALE };

export type FormatMoneyOptions = {
  /** BCP 47 tag, e.g. "en-GB", "fr-FR". Invalid tags fall back to the default locale. */
  locale?: string | null;
  /** "auto" (default): 0 for whole amounts, 2 otherwise. A number forces that many decimals. */
  decimals?: "auto" | number;
};

export function formatMoney(amount: unknown, currency?: string | null, options: FormatMoneyOptions = {}): string {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  const locale = resolveLocale(options.locale);
  const digits = typeof options.decimals === "number" ? options.decimals : Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    // Unknown currency code: never throw while rendering a storefront.
    return `${code} ${value.toLocaleString(locale)}`;
  }
}

/** Symbol only, e.g. NGN -> "₦", USD -> "US$" (en-NG) or "$" (en-US). For input prefixes and form labels. */
export function currencySymbol(currency?: string | null, options: Pick<FormatMoneyOptions, "locale"> = {}): string {
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    const part = new Intl.NumberFormat(resolveLocale(options.locale), { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * Bind a store's (or customer's) currency and locale once, then format many amounts:
 *   const money = moneyFormatter(store);  money(5000) -> "₦5,000"
 * Missing fields fall back to NGN / the deployment default locale.
 */
export function moneyFormatter(scope?: { currency?: string | null; locale?: string | null } | null, base: FormatMoneyOptions = {}) {
  return (amount: unknown, options: FormatMoneyOptions = {}) =>
    formatMoney(amount, scope?.currency, { locale: scope?.locale, ...base, ...options });
}
