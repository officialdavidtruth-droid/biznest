"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { GraduationCap, X, ChevronLeft, ChevronRight } from "lucide-react";
import { findGuide, type PageGuide } from "@/lib/page-guides";

type Step = { eyebrow: string; title: string; body: string; el?: HTMLElement };
type Rect = { top: number; left: number; width: number; height: number };

const HIDE_KEY = "bn-guide:hidden";
const PREF_EVENT = "bn:guide-pref";

function readHidden(): boolean {
  try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
}
function writeHidden(hidden: boolean) {
  try { if (hidden) localStorage.setItem(HIDE_KEY, "1"); else localStorage.removeItem(HIDE_KEY); } catch {}
  window.dispatchEvent(new Event(PREF_EVENT));
}

/** Settings switch: show or hide the floating "Learn this page" button (saved on this device). */
export function GuideToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const sync = () => setOn(!readHidden());
    sync();
    window.addEventListener(PREF_EVENT, sync);
    return () => window.removeEventListener(PREF_EVENT, sync);
  }, []);
  return (
    <div className="mt-6 rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">Help &amp; guides</p>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">
          Show the floating &ldquo;Learn this page&rdquo; button on dashboard pages. Turn it off if it gets in your way; you can turn it back on here any time. Saved on this device.
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show Learn this page button"
          onClick={() => writeHidden(on)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f6410]" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </label>
    </div>
  );
}

const key = (userId: string, rel: string) => `bn-guide:v1:${userId}:${rel || "/"}`;

function relPath(pathname: string): string | null {
  const m = pathname.match(/^(?:\/store)?\/[^/]+\/admin(\/.*)?$/);
  return m ? (m[1] ?? "") : null;
}

/** Build on-screen steps from what is actually on the page. */
function detectScreenSteps(): Step[] {
  const root = document.querySelector("main") ?? document.body;
  const out: Step[] = [];
  const seen = new Set<HTMLElement>();
  const add = (el: HTMLElement | null, title: string, body: string) => {
    if (!el || seen.has(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 16) return;
    seen.add(el);
    out.push({ eyebrow: "On this screen", title, body, el });
  };
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

  const primary = Array.from(root.querySelectorAll<HTMLElement>("a,button")).find((b) => /^(add|new|create|invite|install|send)\b/i.test(text(b)));
  if (primary) add(primary, `"${text(primary)}"`, "This is the main action here. Tap it to start adding something new.");

  const search = root.querySelector<HTMLElement>("input[type=search],input[placeholder*='earch' i]");
  if (search) add(search, "Search", "Type here to find what you are looking for quickly.");

  const select = root.querySelector<HTMLElement>("select,[role=tablist]");
  if (select) add(select, "Filters and tabs", "Switch between views or narrow the list down here.");

  const table = root.querySelector<HTMLElement>("table");
  if (table) add(table, "Your list", "Each row is one record. Tap a row, or the buttons at the end of it, to open or change it.");

  const form = root.querySelector<HTMLElement>("form");
  if (form && !form.contains(search)) add(form, "The form", "Fill in the fields, then use the button at the bottom to save. Required fields are marked.");

  const headings = Array.from(root.querySelectorAll<HTMLElement>("h2,h3")).filter((h) => text(h).length > 2).slice(0, 3);
  headings.forEach((h) => add(h, text(h), "A section of this page. Read down it to see what it covers."));
  return out.slice(0, 6);
}

/**
 * "Learn this page": floating button on every dashboard page. Opens a short
 * guided walkthrough: what the page is for and how to use it (written per
 * page, including apps/plugins), then a spotlight tour of the real controls
 * on screen. Pulses until the user has finished the guide for that page.
 */
export function PageGuideButton({ userId }: { userId: string }) {
  const pathname = usePathname() ?? "";
  const rel = relPath(pathname);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setHidden(readHidden());
    sync();
    window.addEventListener(PREF_EVENT, sync);
    return () => window.removeEventListener(PREF_EVENT, sync);
  }, []);

  function dismissButton() {
    writeHidden(true);
    setHint(true);
    setTimeout(() => setHint(false), 4500);
  }
  useEffect(() => {
    setOpen(false);
    if (rel === null) return;
    try { setDone(localStorage.getItem(key(userId, rel)) === "1"); } catch { setDone(true); }
  }, [rel, userId]);

  const guide: PageGuide | null = useMemo(() => (rel === null ? null : findGuide(rel)), [rel]);

  const start = useCallback(() => {
    const h1 = document.querySelector("main h1")?.textContent?.trim();
    const base: Step[] = guide
      ? [
          { eyebrow: guide.title, title: "What this page is for", body: guide.intro },
          ...guide.steps.map((st, i) => ({ eyebrow: `${guide.title} · ${i + 1}/${guide.steps.length}`, title: st.title, body: st.body })),
        ]
      : [{ eyebrow: "About this page", title: h1 || "This page", body: "Here is a quick tour of what is on this screen." }];
    setSteps([...base, ...detectScreenSteps()]);
    setIndex(0);
    setOpen(true);
  }, [guide]);

  const finish = useCallback(() => {
    setOpen(false);
    setDone(true);
    if (rel !== null) { try { localStorage.setItem(key(userId, rel), "1"); } catch {} }
  }, [rel, userId]);

  const step = steps[index];

  const measure = useCallback(() => {
    const el = step?.el;
    if (!open || !el || !el.isConnected) return setRect(null);
    const r = el.getBoundingClientRect();
    const h = Math.min(r.height, window.innerHeight * 0.45);
    setRect({ top: r.top, left: r.left, width: r.width, height: h });
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open || !step?.el) return setRect(null);
    step.el.style.scrollMarginTop = "88px";
    step.el.scrollIntoView({ block: "start", behavior: "smooth" });
    const t = setTimeout(measure, 350);
    measure();
    return () => clearTimeout(t);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); window.removeEventListener("keydown", onKey); };
  }, [open, measure, steps.length]);

  if (!mounted || rel === null) return null;
  const last = index >= steps.length - 1;

  return createPortal(
    <>
      {!open && !hidden && (
        <div className="bn-guide-fabwrap">
          <button type="button" onClick={start} className={`bn-guide-fab ${done ? "" : "bn-guide-fab-new"}`} aria-label="Learn this page">
            <GraduationCap className="h-5 w-5" />
            <span>Learn this page</span>
          </button>
          <button type="button" onClick={dismissButton} className="bn-guide-fab-x" aria-label="Hide Learn this page button">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {hint && (
        <div className="bn-guide-hint" role="status">Hidden. Turn it back on in Settings → Help &amp; guides.</div>
      )}

      {open && step && (
        <div className="bn-guide-root" role="dialog" aria-label="Page guide">
          {rect ? (
            <div className="bn-guide-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
          ) : (
            <div className="bn-guide-dim" onClick={() => setOpen(false)} />
          )}
          <div className="bn-guide-card" key={index}>
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{step.eyebrow}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close guide" className="-m-1 p-1 opacity-60"><X className="h-4 w-4" /></button>
            </div>
            <h3 className="text-base font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed opacity-80">{step.body}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1.5" aria-hidden>
                {steps.map((_, i) => <span key={i} className={`bn-guide-dot ${i === index ? "bn-guide-dot-on" : ""}`} />)}
              </div>
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button type="button" onClick={() => setIndex(index - 1)} className="bn-guide-btn bn-guide-btn-ghost" aria-label="Back"><ChevronLeft className="h-4 w-4" /></button>
                )}
                <button type="button" onClick={() => (last ? finish() : setIndex(index + 1))} className="bn-guide-btn">
                  {last ? "Got it" : "Next"} {!last && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
