/**
 * Locale layer: the single place that decides which locale numbers, money and dates render in.
 *
 * Safe on server and client: the default is a build-time constant (never read from the browser),
 * so SSR and hydration produce identical output. Nigeria stays the default, so nothing changes
 * for existing stores; a store, customer or deployment can opt into another locale by passing
 * `locale` explicitly or setting NEXT_PUBLIC_DEFAULT_LOCALE.
 */
export const FALLBACK_LOCALE = "en-NG";

/** Returns the tag if the runtime can format it, otherwise null (never throws). */
export function normalizeLocale(tag?: string | null): string | null {
  if (!tag) return null;
  try {
    const [supported] = Intl.NumberFormat.supportedLocalesOf([String(tag).replace(/_/g, "-")]);
    return supported ?? null;
  } catch {
    return null;
  }
}

export const DEFAULT_LOCALE: string = normalizeLocale(process.env.NEXT_PUBLIC_DEFAULT_LOCALE) ?? FALLBACK_LOCALE;

/** Explicit locale if valid, else the deployment default. */
export function resolveLocale(locale?: string | null): string {
  return normalizeLocale(locale) ?? DEFAULT_LOCALE;
}

export function formatNumber(value: unknown, opts: Intl.NumberFormatOptions & { locale?: string | null } = {}): string {
  const { locale, ...fmt } = opts;
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(resolveLocale(locale), fmt).format(safe);
  } catch {
    return String(safe);
  }
}

export function formatDate(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions & { locale?: string | null } = {},
): string {
  if (value === null || value === undefined || value === "") return "";
  const { locale, ...fmt } = opts;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const FIELDS = ["dateStyle", "timeStyle", "weekday", "day", "month", "year", "hour", "minute", "second"] as const;
  const hasField = FIELDS.some((k) => (fmt as Record<string, unknown>)[k] !== undefined);
  const options: Intl.DateTimeFormatOptions = hasField ? fmt : { day: "numeric", month: "short", year: "numeric", ...fmt };
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), options).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
