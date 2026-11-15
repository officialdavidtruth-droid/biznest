"use client";

import type { ReactNode } from "react";

export const card = "rounded-2xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] shadow-[0_2px_8px_rgba(15,23,42,0.025)]";
export const field = "w-full rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-3 py-2.5 text-sm text-[var(--bn-admin-text)] outline-none transition placeholder:text-[var(--bn-admin-muted)] focus:border-[var(--bn-admin-orange)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--bn-admin-orange)_12%,transparent)]";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bn-admin-orange)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--bn-admin-orange-dark)] disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-3.5 py-2.5 text-xs font-bold text-[var(--bn-admin-text)] transition hover:border-[var(--bn-admin-orange)] hover:text-[var(--bn-admin-orange)] disabled:cursor-not-allowed disabled:opacity-50";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${active ? "border-[var(--bn-admin-orange)] bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]" : "border-[var(--bn-admin-border)] text-[var(--bn-admin-muted)] hover:border-[var(--bn-admin-orange)]"}`}
    >
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  grey: "bg-slate-50 text-slate-600 border-slate-200",
};
export function Badge({ tone = "grey", children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${TONES[tone] ?? TONES.grey}`}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--bn-admin-muted)]">{sub}</p>}
    </div>
  );
}

export function download(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);
