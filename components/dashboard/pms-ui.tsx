"use client";

/** Shared look for the PMS screens: one colour per status and a few small helpers. */

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available", OCCUPIED: "Occupied", RESERVED: "Reserved", DIRTY: "Needs cleaning", CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance", OUT_OF_SERVICE: "Out of service",
  PENDING: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked in", CHECKED_OUT: "Checked out", CANCELLED: "Cancelled", NO_SHOW: "No-show",
  PAID: "Paid", UNPAID: "Unpaid", PARTIAL: "Part paid", REFUNDED: "Refunded", PENDING_PAYMENT: "Awaiting payment",
};

type Tone = { dot: string; chip: string; bar: string; cell: string };
// Written out in full so Tailwind can see every class name.
const TONES: Record<string, Tone> = {
  green: { dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25", bar: "bg-emerald-400", cell: "bg-emerald-400/15 border-emerald-400/35 text-emerald-200" },
  blue: { dot: "bg-sky-400", chip: "bg-sky-400/10 text-sky-300 border-sky-400/25", bar: "bg-sky-400", cell: "bg-sky-400/15 border-sky-400/35 text-sky-200" },
  violet: { dot: "bg-violet-400", chip: "bg-violet-400/10 text-violet-300 border-violet-400/25", bar: "bg-violet-400", cell: "bg-violet-400/15 border-violet-400/35 text-violet-200" },
  amber: { dot: "bg-amber-400", chip: "bg-amber-400/10 text-amber-300 border-amber-400/25", bar: "bg-amber-400", cell: "bg-amber-400/15 border-amber-400/35 text-amber-200" },
  red: { dot: "bg-rose-400", chip: "bg-rose-400/10 text-rose-300 border-rose-400/25", bar: "bg-rose-400", cell: "bg-rose-400/15 border-rose-400/35 text-rose-200" },
  grey: { dot: "bg-zinc-400", chip: "bg-zinc-400/10 text-zinc-300 border-zinc-400/25", bar: "bg-zinc-400", cell: "bg-zinc-400/15 border-zinc-400/30 text-zinc-300" },
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  AVAILABLE: "green", OCCUPIED: "blue", RESERVED: "violet", DIRTY: "amber", CLEANING: "amber", MAINTENANCE: "red", OUT_OF_SERVICE: "red",
  PENDING: "amber", CONFIRMED: "violet", CHECKED_IN: "blue", CHECKED_OUT: "grey", CANCELLED: "red", NO_SHOW: "red",
  PAID: "green", UNPAID: "amber", PARTIAL: "amber", REFUNDED: "grey", PENDING_PAYMENT: "amber",
};

export const toneOf = (status: string): Tone => TONES[STATUS_TONE[status] ?? "grey"];
export const labelOf = (status: string) => STATUS_LABEL[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function StatusChip({ status }: { status: string }) {
  const t = toneOf(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {labelOf(status)}
    </span>
  );
}

export function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count?: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
        active ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-[var(--bn-admin-text)] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
    </button>
  );
}

export const shortDate = (v: string | Date) => new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const shortTime = (v: string | Date) => new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const nightsBetween = (a: string | Date, b: string | Date) => Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86_400_000));
export const sameDay = (a: string | Date, b: string | Date) => new Date(a).toDateString() === new Date(b).toDateString();

export const panelCls = "rounded-2xl border border-white/10 bg-white/[0.03]";
export const btnPrimary = "rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400";
export const btnGhost = "rounded-lg border border-white/12 px-3 py-1.5 text-xs text-[var(--bn-admin-text)] transition hover:border-white/25 hover:bg-white/[0.05]";
