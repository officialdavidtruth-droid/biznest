"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, LayoutGrid, X } from "lucide-react";
import { Chip } from "./ui";

export type NavItem<T extends string> = { id: T; label: string; icon: any };
export type NavGroup<T extends string> = { title: string; items: Array<NavItem<T>> };

/** Shared chrome for the FnB and Kitchen Management workspaces: header, desktop sidebar, phone bottom bar and "all sections" sheet. */
export function AppShell<T extends string>({ slug, title, appLabel, groups, bottom, tab, go, badges, chip, hideBottomOn, children }: {
  slug: string; title: string; appLabel: string; groups: Array<NavGroup<T>>; bottom: T[]; tab: T; go: (id: T) => void;
  badges?: Partial<Record<T, number>>; chip?: { text: string; tone: "ok" | "mute"; onClick?: () => void }; hideBottomOn?: T[]; children: ReactNode;
}) {
  const [sheet, setSheet] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const current = all.find((x) => x.id === tab) ?? all[0];
  const moreActive = !bottom.includes(tab);
  const pick = (id: T) => { setSheet(false); go(id); };
  useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [sheet]);

  return <div className="bn-fnb min-h-screen bg-[var(--bn-admin-page)] text-[var(--bn-admin-text)]">
    <style>{`.bn-fnb{--fnb-warn:#b45309;--fnb-info:#1d4ed8}html.bn-admin-dark .bn-fnb{--fnb-warn:#fbbf24;--fnb-info:#93c5fd}`}</style>
    <header className="sticky top-0 z-30 border-b border-[var(--bn-admin-border)] bg-[color-mix(in_srgb,var(--bn-admin-surface)_92%,transparent)] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:px-7">
        <a href={`/store/${slug}/admin/apps`} aria-label="Back to Apps" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--bn-admin-border)] text-[var(--bn-admin-text)]"><ArrowLeft className="h-4 w-4" /></a>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold leading-tight text-[var(--bn-admin-text-strong)]">{title}</p><p className="truncate text-[11px] leading-tight text-[var(--bn-admin-muted)]">{appLabel} · {current.label}</p></div>
        {chip && <button onClick={chip.onClick} className="shrink-0"><Chip tone={chip.tone} dot>{chip.text}</Chip></button>}
        <button onClick={() => setSheet(true)} aria-label="All sections" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--bn-admin-border)] text-[var(--bn-admin-text)] lg:hidden"><LayoutGrid className="h-4 w-4" /></button>
      </div>
    </header>

    <div className="flex">
      <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-60 shrink-0 self-start overflow-y-auto border-r border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-3 lg:block">
        {groups.map((g) => <div key={g.title} className="mb-4"><p className="px-3 pb-1.5 text-[11px] font-bold text-[var(--bn-admin-muted)]">{g.title}</p>{g.items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`mb-0.5 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold transition ${tab === id ? "bg-[var(--bn-admin-active)] text-white" : "text-[var(--bn-admin-text)] hover:bg-[var(--bn-admin-surface-2)]"}`}><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{(badges?.[id] ?? 0) > 0 && <span className={`rounded-full px-1.5 text-[10px] font-extrabold ${tab === id ? "bg-white/25" : "bg-[var(--bn-admin-active)] text-white"}`}>{badges?.[id]}</span>}</button>)}</div>)}
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-7"><div className="mx-auto max-w-6xl">{children}</div></main>
    </div>

    {!hideBottomOn?.includes(tab) && <nav aria-label={`${appLabel} sections`} className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--bn-admin-border)] bg-[color-mix(in_srgb,var(--bn-admin-surface)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {bottom.map((id) => { const it = all.find((x) => x.id === id)!; const Icon = it.icon; const on = tab === id; const n = badges?.[id] ?? 0; return <button key={id} onClick={() => go(id)} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold ${on ? "text-[var(--bn-admin-active)]" : "text-[var(--bn-admin-muted)]"}`}><span className="relative"><Icon className="h-5 w-5" />{n > 0 && <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--bn-admin-danger)] px-1 text-[9px] font-extrabold text-white">{n}</span>}</span>{it.label}</button>; })}
        <button onClick={() => setSheet(true)} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold ${moreActive ? "text-[var(--bn-admin-active)]" : "text-[var(--bn-admin-muted)]"}`}><LayoutGrid className="h-5 w-5" />More</button>
      </div>
    </nav>}

    {sheet && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[var(--bn-admin-surface)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--bn-admin-border)]" />
        <div className="mb-2 flex items-center justify-between"><p className="text-base font-extrabold text-[var(--bn-admin-text-strong)]">All sections</p><button onClick={() => setSheet(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bn-admin-surface-2)]"><X className="h-4 w-4" /></button></div>
        {groups.map((g) => <div key={g.title} className="mt-4"><p className="mb-2 text-[11px] font-bold text-[var(--bn-admin-muted)]">{g.title}</p><div className="grid grid-cols-3 gap-2">{g.items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => pick(id)} className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border px-1 text-center text-xs font-bold ${tab === id ? "border-transparent bg-[var(--bn-admin-active)] text-white" : "border-[var(--bn-admin-border)] text-[var(--bn-admin-text)]"}`}><Icon className="h-5 w-5" />{label}</button>)}</div></div>)}
      </div>
    </div>}
  </div>;
}
