// Pure helpers for restaurant table reservations (no database access).
export type ReservationConfig = {
  enabled: boolean;
  open: string; // "HH:MM" local
  close: string; // "HH:MM" local — last seating must finish by this time
  durationMins: number;
  maxParty: number;
  daysAhead: number;
  leadMins: number;
};

export const DEFAULT_RESERVATION_CONFIG: ReservationConfig = { enabled: true, open: "12:00", close: "22:00", durationMins: 90, maxParty: 10, daysAhead: 30, leadMins: 60 };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function readReservationConfig(storefrontConfig: unknown): ReservationConfig {
  const raw = storefrontConfig && typeof storefrontConfig === "object" ? (storefrontConfig as Record<string, unknown>).tableReservations : null;
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_RESERVATION_CONFIG;
  const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    open: typeof r.open === "string" && TIME_RE.test(r.open) ? r.open : d.open,
    close: typeof r.close === "string" && TIME_RE.test(r.close) ? r.close : d.close,
    durationMins: num(r.durationMins, 30, 360, d.durationMins),
    maxParty: num(r.maxParty, 1, 100, d.maxParty),
    daysAhead: num(r.daysAhead, 1, 180, d.daysAhead),
    leadMins: num(r.leadMins, 0, 1440, d.leadMins),
  };
}

export function toMinutes(hhmm: string) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
export function fromMinutes(total: number) { return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

/** Slot start times ("HH:MM") every 30 minutes, so a sitting of durationMins ends by closing time. */
export function slotStarts(cfg: ReservationConfig): string[] {
  const out: string[] = [];
  const last = toMinutes(cfg.close) - cfg.durationMins;
  for (let t = toMinutes(cfg.open); t <= last; t += 30) out.push(fromMinutes(t));
  return out;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { return aStart < bEnd && bStart < aEnd; }

export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
