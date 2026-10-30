import { parseRatesResponse, crossRate, type UsdRates } from "@/lib/fx/convert";

/**
 * Display-only exchange rates. Default source is the keyless Open Access
 * endpoint of ExchangeRate-API: daily updates, rate limited, and it REQUIRES a
 * visible attribution link wherever its rates are shown (ApproxPrice renders
 * it). Set FX_RATES_URL to a paid/keyed USD-based endpoint with the same JSON
 * shape to remove those limits. These rates are estimates only: never use them
 * to compute what a customer is charged.
 */
const DEFAULT_URL = "https://open.er-api.com/v6/latest/USD";
const REVALIDATE_SECONDS = 12 * 60 * 60;

export async function getUsdRates(): Promise<{ rates: UsdRates; updatedAt: string | null } | null> {
  try {
    const res = await fetch(process.env.FX_RATES_URL || DEFAULT_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null; // includes the provider's 429 throttle
    return parseRatesResponse(await res.json());
  } catch {
    return null;
  }
}

export async function getRate(from: string, to: string): Promise<{ rate: number; updatedAt: string | null } | null> {
  if (from.toUpperCase() === to.toUpperCase()) return { rate: 1, updatedAt: null };
  const data = await getUsdRates();
  if (!data) return null;
  const rate = crossRate(data.rates, from, to);
  return rate ? { rate, updatedAt: data.updatedAt } : null;
}
