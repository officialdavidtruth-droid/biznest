"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Copy, Lightbulb, Printer, TrendingUp, X } from "lucide-react";
import type { Playbook } from "@/lib/playbooks";

const storageKey = (slug: string, key: string) => `bn-playbook:v1:${slug}:${key}`;

export function PlaybookReader({ playbook, slug, storeUrl, catalogPath }: { playbook: Playbook; slug: string; storeUrl: string; catalogPath: string }) {
  const [view, setView] = useState<number | null>(null); // null = cover / contents
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const key = storageKey(slug, playbook.key);
  const base = `/${slug}/admin`;

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(key) ?? "{}")); } catch { /* storage unavailable */ }
  }, [key]);

  const toggle = useCallback((id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [key]);

  const stats = useMemo(() => {
    const perChapter = playbook.chapters.map((c) => c.steps.filter((_, i) => done[`${c.id}:${i}`]).length);
    const total = playbook.chapters.reduce((n, c) => n + c.steps.length, 0);
    const complete = perChapter.reduce((n, x) => n + x, 0);
    return { perChapter, total, complete, pct: total ? Math.round((complete / total) * 100) : 0 };
  }, [playbook, done]);

  const open = (i: number | null) => { setView(i); setCopied(null); window.scrollTo({ top: 0 }); };
  const hrefFor = (path: string) => `${base}${path === "catalog" ? catalogPath : path}`;
  const minutes = playbook.chapters.reduce((n, c) => n + c.minutes, 0);

  if (view === null) {
    const next = stats.perChapter.findIndex((n, i) => n < playbook.chapters[i].steps.length);
    return (
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 p-6 text-white shadow-lg sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-900">
            <BookOpen className="h-3 w-3" /> Free ebook
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{playbook.title}</h1>
          <p className="mt-2 text-base text-white/80">{playbook.tagline}</p>
          <p className="mt-4 text-xs text-white/60">{playbook.chapters.length} chapters · about {minutes} minutes · made for your kind of business</p>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-white/80"><span>Your progress</span><span>{stats.pct}%</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${stats.pct}%` }} /></div>
          </div>
          <button type="button" onClick={() => open(next === -1 ? 0 : next)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-bold text-slate-900 hover:brightness-105 sm:w-auto">
            {stats.complete === 0 ? "Start reading" : next === -1 ? "Read again" : "Continue where you left off"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contents</h2>
        <ol className="space-y-2">
          {playbook.chapters.map((c, i) => {
            const n = stats.perChapter[i];
            const full = n === c.steps.length;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => open(i)} className="flex w-full items-center gap-3 rounded-xl border bg-background p-3.5 text-left hover:bg-muted/50">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${full ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}`}>
                    {full ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.summary}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{n}/{c.steps.length}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const c = playbook.chapters[view];
  const render = (t: string) => t.split("{link}").join(storeUrl).split("{code}").join("[your coupon code]");
  const allScripts = [...(c.script ? [c.script] : []), ...(c.scripts ?? [])];
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(render(text)); setCopied(label); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => open(null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-4 w-4" /> Contents
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted print:hidden" aria-label="Print or save as PDF">
          <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print / PDF</span>
        </button>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${((view + 1) / playbook.chapters.length) * 100}%` }} /></div>

      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Chapter {view + 1} of {playbook.chapters.length} · {c.minutes} min</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{c.title}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{c.intro}</p>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Do this</h2>
      <ul className="space-y-2">
        {c.steps.map((s, i) => {
          const id = `${c.id}:${i}`;
          const on = !!done[id];
          return (
            <li key={id}>
              <button type="button" onClick={() => toggle(id)} aria-pressed={on} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${on ? "border-emerald-300 bg-emerald-50" : "bg-background hover:bg-muted/50"}`}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>{on && <Check className="h-4 w-4" />}</span>
                <span className={`text-sm leading-relaxed ${on ? "text-slate-500 line-through decoration-slate-300" : ""}`}>{s}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {c.methods && c.methods.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-4 w-4" /> Proven plays</h2>
          <div className="space-y-3">
            {c.methods.map((m) => (
              <div key={m.title} className="rounded-xl border bg-background p-4">
                <h3 className="text-sm font-bold">{m.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{m.how}</p>
                {m.example && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900"><span className="font-semibold">Example: </span>{m.example}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">These are well-known business methods, not guarantees. Your results depend on your product, price, effort and market.</p>
        </>
      )}

      {allScripts.length > 0 && (
        <div className="mt-5 space-y-3">
          {allScripts.map((sc) => (
            <div key={sc.label} className="rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{sc.label}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{render(sc.text)}</p>
              <button type="button" onClick={() => copy(sc.label, sc.text)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 print:hidden">
                {copied === sc.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === sc.label ? "Copied" : "Copy message"}
              </button>
            </div>
          ))}
        </div>
      )}

      {c.avoid && c.avoid.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Avoid these</h2>
          <ul className="space-y-2">
            {c.avoid.map((a) => (
              <li key={a} className="flex gap-3 rounded-xl border border-red-200 bg-red-50/60 p-3.5 text-sm leading-relaxed text-red-950">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /><span>{a}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {c.tip && (
        <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>{c.tip}</p>
        </div>
      )}

      {c.action && (
        <Link href={hrefFor(c.action.path)} className="mt-5 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white hover:bg-slate-700 print:hidden">
          <span>{c.action.label}</span><ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 print:hidden">
        <button type="button" disabled={view === 0} onClick={() => open(view - 1)} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {view < playbook.chapters.length - 1 ? (
          <button type="button" onClick={() => open(view + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800">
            Next chapter <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={() => open(null)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800">
            <Check className="h-4 w-4" /> Finish
          </button>
        )}
      </div>
    </div>
  );
}
