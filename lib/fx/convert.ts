/**
 * Pure exchange-rate helpers (no I/O) so they are unit-testable and safe to
 * import from client components. Rates are "units of currency per 1 USD", the
 * shape returned by open.er-api.com /v6/latest/USD.
 */
export type UsdRates = Record<string, number>;

/** Validates a provider payload; returns the rate table or null if it isn't trustworthy. */
export function parseRatesResponse(payload: unknown): { rates: UsdRates; updatedAt: string | null } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { result?: unknown; rates?: unknown; time_last_update_utc?: unknown };
  if (p.result !== "success" || !p.rates || typeof p.rates !== "object") return null;
  const rates: UsdRates = {};
  for (const [code, value] of Object.entries(p.rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === "number" && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  if (!rates.USD) return null; // a USD-based table must contain USD itself
  return { rates, updatedAt: typeof p.time_last_update_utc === "string" ? p.time_last_update_utc : null };
}

/** Cross rate: how many `to` you get for 1 `from`. Null if either currency is unknown. */
export function crossRate(rates: UsdRates, from: string, to: string): number | null {
  const f = rates[from.toUpperCase()];
  const t = rates[to.toUpperCase()];
  if (!f || !t) return null;
  return t / f;
}

/** Decimal places a currency normally uses (JPY 0, USD 2, KWD 3). */
export function currencyDigits(code: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function convertAmount(amount: number, rate: number, toCurrency: string): number {
  const d = currencyDigits(toCurrency);
  const f = 10 ** d;
  return Math.round(amount * rate * f) / f;
}
