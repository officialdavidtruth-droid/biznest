"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

// Set from the store on every render of FnbWorkspace, before any panel renders.
let activeCurrency = "NGN";
export function setFnbCurrency(code: string) { activeCurrency = code || "NGN"; }
export function money(n: number) { return formatMoney(n, activeCurrency); }
export function time(v: string | Date) { return formatDate(new Date(v), { hour: "2-digit", minute: "2-digit" }); }
export function date(v: string | Date) { return formatDate(new Date(v), { day: "2-digit", month: "short", year: "numeric" }); }
export function label(v: string) { return v.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (m) => m.toUpperCase()); }
export function itemName(i: any) { return i.variant?.product?.name ? `${i.variant.product.name} — ${i.variant.label}` : i.product?.name || "Menu item"; }
export function orderRef(o: any) { return `#${String(o.id).slice(-6).toUpperCase()}`; }
export function minutesAgo(v: string | Date, now: number) { return Math.max(0, Math.floor((now - new Date(v).getTime()) / 60000)); }

export type Tone = "ok" | "warn" | "info" | "bad" | "mute";
const toneVar: Record<Tone, string> = { ok: "var(--bn-admin-active)", warn: "var(--fnb-warn)", info: "var(--fnb-info)", bad: "var(--bn-admin-danger)", mute: "var(--bn-admin-muted)" };
export function toneStyle(t: Tone) { return { color: toneVar[t], backgroundColor: `color-mix(in srgb, ${toneVar[t]} 13%, transparent)` }; }
export function statusTone(v: string): Tone {
  if (["PAID", "COMPLETED", "DELIVERED", "AVAILABLE", "IN_STOCK", "RECEIVED", "SERVED", "FULFILLED", "CONFIRMED"].includes(v)) return "ok";
  if (["QUEUED", "SENT", "PENDING"].includes(v)) return "info";
  if (["STARTED", "READY", "EXPO", "IN_PROGRESS", "PARTIALLY_RECEIVED", "LOW_STOCK"].includes(v)) return "warn";
  if (["CANCELLED", "REFUNDED", "OUT_OF_STOCK"].includes(v)) return "bad";
  return "mute";
}

export const card = "rounded-2xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] shadow-[0_1px_2px_rgba(15,23,42,.04)]";
export const input = "w-full rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-3 py-3 text-sm text-[var(--bn-admin-text)] outline-none transition focus:border-[var(--bn-admin-active)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bn-admin-active)_25%,transparent)] disabled:opacity-60";
export const btnPrimary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--bn-admin-active)] px-4 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-50";
export const btnGhost = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-4 text-sm font-semibold text-[var(--bn-admin-text)] transition active:scale-[.98] disabled:opacity-50";

export function Chip({ tone = "mute", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span style={toneStyle(tone)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold">{dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />}{children}</span>;
}

export function Page({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return <div className="space-y-5">
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[var(--bn-admin-text-strong)] sm:text-2xl">{title}</h1>{sub && <p className="mt-1 max-w-2xl text-[13px] leading-snug text-[var(--bn-admin-muted)]">{sub}</p>}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </div>;
}

export function Section({ title, hint, right, children, className = "" }: { title?: string; hint?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${card} p-4 sm:p-5 ${className}`}>
    {(title || right) && <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0">{title && <h2 className="text-sm font-bold text-[var(--bn-admin-text-strong)]">{title}</h2>}{hint && <p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">{hint}</p>}</div>{right}</div>}
    {children}
  </section>;
}

export function Stat({ icon: Icon, label: text, value, sub, tone = "ok" }: { icon: any; label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return <div className={`${card} p-3.5 sm:p-4`}>
    <div className="flex items-center gap-2"><span style={toneStyle(tone)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Icon className="h-4 w-4" /></span><span className="truncate text-xs font-semibold text-[var(--bn-admin-muted)]">{text}</span></div>
    <p className="mt-2.5 truncate text-xl font-extrabold tracking-tight text-[var(--bn-admin-text-strong)] sm:text-2xl">{value}</p>
    {sub && <p className="mt-0.5 truncate text-[11px] text-[var(--bn-admin-muted)]">{sub}</p>}
  </div>;
}

export function Empty({ icon: Icon, title, text, action }: { icon?: any; title: string; text?: string; action?: ReactNode }) {
  return <div className="col-span-full flex flex-col items-center rounded-2xl border border-dashed border-[var(--bn-admin-border)] px-6 py-10 text-center">
    {Icon && <span style={toneStyle("mute")} className="mb-3 grid h-11 w-11 place-items-center rounded-full"><Icon className="h-5 w-5" /></span>}
    <p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">{title}</p>
    {text && <p className="mt-1 max-w-xs text-xs text-[var(--bn-admin-muted)]">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function Segmented<T extends string>({ value, onChange, options, scroll }: { value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string; count?: number }>; scroll?: boolean }) {
  return <div className={`flex gap-1.5 ${scroll ? "-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" : "flex-wrap"}`}>
    {options.map((o) => <button key={o.id} onClick={() => onChange(o.id)} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition ${value === o.id ? "border-transparent bg-[var(--bn-admin-active)] text-white" : "border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] text-[var(--bn-admin-muted)]"}`}>{o.label}{o.count != null && <span className={`rounded-full px-1.5 text-[10px] ${value === o.id ? "bg-white/25" : "bg-[var(--bn-admin-surface-2)]"}`}>{o.count}</span>}</button>)}
  </div>;
}

export function Avatar({ name, tone = "ok" }: { name: string; tone?: Tone }) {
  return <span style={toneStyle(tone)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold">{(name || "?").trim().charAt(0).toUpperCase()}</span>;
}

export function Meter({ value, max, tone = "ok" }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bn-admin-surface-2)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: toneVar[tone] }} /></div>;
}

export function Field({ label: text, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[var(--bn-admin-text)]">{text}</span>{children}{hint && <span className="mt-1 block text-[11px] text-[var(--bn-admin-muted)]">{hint}</span>}</label>;
}
