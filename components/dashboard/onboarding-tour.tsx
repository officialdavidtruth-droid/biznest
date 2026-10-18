"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import type { TourStep } from "@/lib/onboarding-tour";

const START_EVENT = "bn:start-tour";
const POP_W = 340;
const GAP = 16;
const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function storageKey(userId: string, slug: string) {
  return `bn-tour:v1:${userId}:${slug}`;
}

/** Small button (topbar / mobile bar) that replays the tour. */
export function TourLauncherButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(START_EVENT))}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}
      aria-label="Take the tour"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Take the tour</span>
    </button>
  );
}

/**
 * First-run pointer tour: dims the page, spotlights a real dashboard element
 * and explains it. Starts once automatically for a brand-new owner (autoStart)
 * and can be replayed with <TourLauncherButton />. "Seen" is remembered in
 * localStorage per user + store.
 */
export function OnboardingTour({
  userId,
  slug,
  steps,
  autoStart,
}: {
  userId: string;
  slug: string;
  steps: TourStep[];
  autoStart: boolean;
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [desktop, setDesktop] = useState(true);
  const [rect, setRect] = useState<Rect | null>(null);
  const [popH, setPopH] = useState(220);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const visible = steps.filter((s) => (desktop ? s.kind !== "group" : s.kind !== "item"));
  const step = visible[Math.min(index, visible.length - 1)];

  const markDone = useCallback(() => {
    try { localStorage.setItem(storageKey(userId, slug), "done"); } catch { /* storage unavailable */ }
  }, [userId, slug]);

  const close = useCallback(() => { setActive(false); markDone(); }, [markDone]);

  // Track viewport size class.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Auto-start once for new owners; replay on demand.
  useEffect(() => {
    function start() { setIndex(0); setActive(true); }
    window.addEventListener(START_EVENT, start);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (autoStart) {
      let seen = false;
      try { seen = localStorage.getItem(storageKey(userId, slug)) === "done"; } catch { seen = true; }
      if (!seen) timer = setTimeout(start, 900);
    }
    return () => { window.removeEventListener(START_EVENT, start); if (timer) clearTimeout(timer); };
  }, [autoStart, userId, slug]);

  // Find + measure the target for the current step.
  const measure = useCallback(() => {
    if (!active || !step?.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const r = el?.getBoundingClientRect();
    if (!el || !r || r.width === 0 || r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active || !step?.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (el && el.getBoundingClientRect().width > 0) el.scrollIntoView({ block: "center", inline: "nearest" });
    measure();
  }, [active, step, measure]);

  useEffect(() => {
    if (!active) return;
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); };
  }, [active, measure]);

  useLayoutEffect(() => {
    if (popRef.current) setPopH(popRef.current.offsetHeight);
  }, [active, index, rect]);

  const go = useCallback((d: 1 | -1) => {
    setIndex((i) => {
      const n = i + d;
      return Math.max(0, Math.min(n, visible.length - 1));
    });
  }, [visible.length]);

  const isLast = index >= visible.length - 1;

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") { if (isLast) close(); else go(1); }
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, go, isLast]);

  useEffect(() => { if (active) nextRef.current?.focus(); }, [active, index]);

  if (!active || !step || typeof document === "undefined") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(POP_W, vw - 24);
  let style: React.CSSProperties;
  let arrow: { side: "left" | "top" | "bottom"; offset: number } | null = null;

  if (!rect) {
    style = { top: Math.max(12, (vh - popH) / 2), left: Math.max(12, (vw - w) / 2), width: w };
  } else if (rect.left + rect.width + GAP + w <= vw - 12) {
    const top = Math.min(Math.max(12, rect.top + rect.height / 2 - popH / 2), vh - popH - 12);
    style = { top, left: rect.left + rect.width + GAP, width: w };
    arrow = { side: "left", offset: Math.min(Math.max(18, rect.top + rect.height / 2 - top), popH - 18) };
  } else if (rect.top + rect.height + GAP + popH <= vh - 12) {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
    style = { top: rect.top + rect.height + GAP, left, width: w };
    arrow = { side: "top", offset: Math.min(Math.max(18, rect.left + rect.width / 2 - left), w - 18) };
  } else {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
    style = { top: Math.max(12, rect.top - GAP - popH), left, width: w };
    arrow = { side: "bottom", offset: Math.min(Math.max(18, rect.left + rect.width / 2 - left), w - 18) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998]" aria-live="polite">
      {/* Click shield so the page underneath can't be used mid-tour */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/90 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/60" />
      )}

      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="absolute rounded-xl bg-white p-4 text-slate-900 shadow-2xl"
        style={style}
      >
        {arrow && (
          <span
            aria-hidden
            className="absolute h-3 w-3 rotate-45 bg-white"
            style={
              arrow.side === "left"
                ? { left: -6, top: arrow.offset - 6 }
                : arrow.side === "top"
                ? { top: -6, left: arrow.offset - 6 }
                : { bottom: -6, left: arrow.offset - 6 }
            }
          />
        )}
        <button type="button" onClick={close} aria-label="Close tour" className="absolute right-2.5 top-2.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
        {step.eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{step.eyebrow}</p>}
        <h2 className="pr-6 text-base font-semibold">{step.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">{index + 1} of {visible.length}</span>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button type="button" onClick={close} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">
                Skip tour
              </button>
            )}
            {index > 0 && (
              <button type="button" onClick={() => go(-1)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (isLast ? close() : go(1))}
              className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              {isLast ? "Finish" : index === 0 ? "Start tour" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
