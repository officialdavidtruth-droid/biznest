import { getCountryByName } from "@/lib/geo";

/**
 * A store operates in ONE currency, derived from the vendor's business
 * country. Products inherit it, so a cart can never mix currencies.
 * Keyed by ISO 3166-1 alpha-2 (lib/geo/countries.ts). Countries not listed
 * fall back to NGN, which is what every existing store already uses.
 */
const EURO = ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK"];
const XOF = ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"];
const XAF = ["CM", "CF", "TD", "CG", "GQ", "GA"];
const SINGLE: Record<string, string> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", UG: "UGX", TZ: "TZS", RW: "RWF", EG: "EGP", MA: "MAD", ET: "ETB", ZM: "ZMW", BW: "BWP", NA: "NAD", MU: "MUR",
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", IN: "INR", CN: "CNY", JP: "JPY", AE: "AED", SA: "SAR", BR: "BRL", MX: "MXN", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
};
const BY_CODE: Record<string, string> = { ...SINGLE };
for (const c of EURO) BY_CODE[c] = "EUR";
for (const c of XOF) BY_CODE[c] = "XOF";
for (const c of XAF) BY_CODE[c] = "XAF";

export const DEFAULT_STORE_CURRENCY = "NGN";

/** ISO currency for a country display name, or null when we don't map it. */
export function currencyForCountry(countryName?: string | null): string | null {
  const country = getCountryByName(countryName);
  return country ? BY_CODE[country.code] ?? null : null;
}

/** Same mapping by ISO alpha-2 code (e.g. a browser locale region such as "US"). */
export function currencyForCountryCode(code?: string | null): string | null {
  return code ? BY_CODE[code.toUpperCase()] ?? null : null;
}

export function resolveStoreCurrency(countryName?: string | null): string {
  return currencyForCountry(countryName) ?? DEFAULT_STORE_CURRENCY;
}

/**
 * Currencies the payment gateways can actually charge today. Paystack,
 * Flutterwave and Korapay initialisation is NGN-only in lib/payments/*, so an
 * order in any other currency must not be sent to a gateway: the amount would
 * be charged as naira. Widen this only when the gateway code sends the real
 * currency.
 */
export const GATEWAY_CHARGEABLE_CURRENCIES: ReadonlySet<string> = new Set(["NGN"]);

export function isGatewayChargeable(currency?: string | null): boolean {
  return GATEWAY_CHARGEABLE_CURRENCIES.has((currency ?? "").trim().toUpperCase());
}
