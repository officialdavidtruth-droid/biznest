"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { TemplateArrangement } from "@/lib/storefront/arrangement";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type ArrangeableSection = { key: string; label: string; hidden: boolean };

const pretty = (v: string) => v.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

const SKIP_TAGS = new Set(["HEADER", "FOOTER", "NAV", "ASIDE", "SCRIPT", "STYLE"]);
const SKIP_CLASS = /(^|[-_ ])(header|nav|navbar|footer|topbar|top-bar|announce|menu|sidebar|promo-bar)([-_ ]|$)/i;

/**
 * A block worth moving: a <section>, or a substantial <div>/<article>/<main>. Page chrome (header, nav,
 * footer, sidebar) is never movable. Already-tagged blocks stay candidates even while hidden.
 */
function isBlock(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.dataset.arrangeKey) return true;
  if (SKIP_TAGS.has(el.tagName) || SKIP_CLASS.test(el.className?.toString() ?? "")) return false;
  if (!["SECTION", "DIV", "ARTICLE", "MAIN"].includes(el.tagName)) return false;
  if (el.tagName === "SECTION") return true;
  return el.offsetHeight >= 80 && (el.textContent?.trim().length ?? 0) > 0;
}

/** The element with the most movable blocks as direct children: that is the page body the template stacks. */
function findContainer(root: HTMLElement): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestCount = 1;
  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of all) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    const n = Array.from(el.children).filter(isBlock).length;
    if (n > bestCount) { best = el; bestCount = n; }
  }
  return best;
}

const isMovable = (el: Element) => isBlock(el);

function keyFor(el: Element, seen: Map<string, number>): string {
  const cls = (el.className?.toString() ?? "").split(/\s+/).filter(Boolean)[0] ?? el.tagName.toLowerCase();
  const n = seen.get(cls) ?? 0;
  seen.set(cls, n + 1);
  return `${cls}:${n}`;
}

function labelFor(el: Element, key: string): string {
  const heading = el.querySelector("h1,h2,h3")?.textContent?.replace(/\s+/g, " ").trim();
  if (heading) return heading.length > 48 ? `${heading.slice(0, 45)}…` : heading;
  return pretty(key.split(":")[0].replace(/^[a-z]{1,3}-/i, ""));
}

function apply(container: HTMLElement, arrangement: TemplateArrangement): ArrangeableSection[] {
  const kids = Array.from(container.children) as HTMLElement[];
  // Undo the previous pass first so heights can be measured and nothing stays hidden by mistake.
  kids.forEach((el) => { el.style.display = ""; el.style.order = ""; });
  const seen = new Map<string, number>();
  const keyed = kids.map((el) => (isMovable(el) ? { el, key: keyFor(el, seen) } : { el, key: null as string | null }));
  const movable = keyed.filter((k) => k.key);
  const rank = (key: string, natural: number) => {
    const i = arrangement.order.indexOf(key);
    return i === -1 ? 1000 + natural : i;
  };
  const sorted = movable.map((m, natural) => ({ ...m, r: rank(m.key as string, natural) })).sort((a, b) => a.r - b.r);

  // Non-movable children (nav, hero, footer) keep their slot; movable ones fill the remaining slots in the new order.
  let next = 0;
  const finalSeq = keyed.map((k) => (k.key ? sorted[next++] : k));

  const display = getComputedStyle(container).display;
  const direction = getComputedStyle(container).flexDirection;
  const isGrid = display === "grid" || display === "inline-grid";
  const isColumnFlex = display === "flex" && direction.startsWith("column");
  const needsChange = arrangement.order.length > 0 || arrangement.hidden.length > 0;
  if (!isGrid && !isColumnFlex) {
    if (needsChange) { container.style.display = "flex"; container.style.flexDirection = "column"; }
    else { container.style.removeProperty("display"); container.style.removeProperty("flex-direction"); }
  }

  const report: ArrangeableSection[] = [];
  finalSeq.forEach((item, index) => {
    item.el.style.order = needsChange ? String(index) : "";
    if (item.key) {
      const hidden = arrangement.hidden.includes(item.key);
      item.el.style.display = hidden ? "none" : "";
      item.el.dataset.arrangeKey = item.key;
      report.push({ key: item.key, label: labelFor(item.el, item.key), hidden });
    }
  });
  return report;
}

/**
 * Wraps a template's homepage. Applies the owner's saved section order and hidden list with CSS `order`
 * (no DOM moves, so React is never confused). Inside the Customize preview iframe it also reports the
 * sections it found and applies unsaved changes sent from the editor, so the preview reacts live.
 */
export function SectionArranger({ arrangement, children }: { arrangement: TemplateArrangement; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<TemplateArrangement>(arrangement);

  const run = (next: TemplateArrangement) => {
    const root = rootRef.current;
    if (!root) return;
    const container = findContainer(root);
    const report = container ? apply(container, next) : [];
    const inPreview = window.parent !== window && new URLSearchParams(window.location.search).get("preview") === "template";
    if (inPreview) window.parent.postMessage({ type: "BIZNEST_TEMPLATE_SECTIONS", sections: report }, window.location.origin);
  };

  useIsoLayoutEffect(() => {
    currentRef.current = arrangement;
    run(arrangement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement.order.join("|"), arrangement.hidden.join("|")]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== "BIZNEST_TEMPLATE_ARRANGE") return;
      const order = Array.isArray(event.data.order) ? event.data.order.filter((v: unknown) => typeof v === "string") : [];
      const hidden = Array.isArray(event.data.hidden) ? event.data.hidden.filter((v: unknown) => typeof v === "string") : [];
      currentRef.current = { order, hidden };
      run(currentRef.current);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // display: contents keeps the wrapper out of the template's layout entirely.
  return <div ref={rootRef} style={{ display: "contents" }}>{children}</div>;
}
