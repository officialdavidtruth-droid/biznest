"use client";

import { useEffect, useState } from "react";
import { currencyForCountryCode } from "@/lib/store-currency";
import { convertAmount } from "@/lib/fx/convert";
import { formatMoney } from "@/lib/utils/format-money";

const STORAGE_KEY = "bn-shopper-currency";
const EVENT = "bn-shopper-currency-change";
const CHOICES = ["USD", "GBP", "EUR", "CAD", "AUD", "GHS", "KES", "ZAR", "AED"];

// One lookup per from/to pair per page session.
const rateCache = new Map<string, Promise<number | null>>();
function fetchRate(from: string, to: string): Promise<number | null> {
  const key = `${from}>${to}`;
  let p = rateCache.get(key);
  if (!p) {
    p = fetch(`/api/fx?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && typeof j.rate === "number" ? (j.rate as number) : null))
      .catch(() => null);
    rateCache.set(key, p);
  }
  return p;
}

/**
 * The currency the shopper wants estimates in. null = automatic (from the
 * browser's region). Starts as the store currency so server and client render
 * the same HTML, then updates after hydration.
 */
function useDisplayCurrency(storeCurrency: string): [string, (c: string | null) => void] {
  const [display, setDisplay] = useState(storeCurrency);
  useEffect(() => {
    const read = () => {
      let chosen: string | null = null;
      try { chosen = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
      if (chosen) return setDisplay(chosen);
      let region: string | undefined;
      try { region = new Intl.Locale(navigator.language).region; } catch { /* unknown locale */ }
      setDisplay(currencyForCountryCode(region) ?? storeCurrency);
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, [storeCurrency]);
  const choose = (c: string | null) => {
    try { if (c) localStorage.setItem(STORAGE_KEY, c); else localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [display, choose];
}

/**
 * "≈ $20.00" estimate under a price, with an honest note that the shopper is
 * still charged in the store's currency. Renders nothing when there is nothing
 * to convert or the rate is unavailable. The attribution link is required by
 * the default rate provider (see lib/fx/rates.ts).
 */
export function ApproxPrice({ amount, currency, picker = false }: { amount: number; currency: string; picker?: boolean }) {
  const store = currency.toUpperCase();
  const [display, choose] = useDisplayCurrency(store);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setRate(null);
    if (display !== store) fetchRate(store, display).then((r) => live && setRate(r));
    return () => { live = false; };
  }, [store, display]);

  const options = [...new Set([store, display, ...CHOICES])];
  const showEstimate = display !== store && rate !== null && Number.isFinite(amount);
  if (!showEstimate && !picker) return null;

  return (
    <div className="approx-price" style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>
      {showEstimate && (
        <div>
          <strong>≈ {formatMoney(convertAmount(amount, rate!, display), display, { decimals: undefined })}</strong>{" "}
          <span>estimate · you pay in {store}</span>
        </div>
      )}
      {picker && (
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Show estimate in
          <select value={display} onChange={(e) => choose(e.target.value === store ? store : e.target.value)} style={{ fontSize: 12 }}>
            {options.map((c) => <option key={c} value={c}>{c === store ? `${c} (store currency)` : c}</option>)}
          </select>
        </label>
      )}
      {showEstimate && (
        <div style={{ fontSize: 11 }}>
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a>
        </div>
      )}
    </div>
  );
}
