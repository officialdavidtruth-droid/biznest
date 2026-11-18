"use client";

import { useEffect } from "react";
import { normalizeText, type TextOverrides } from "@/lib/storefront/text-overrides";

/**
 * One mount point (the store layout) that gives EVERY template and page two abilities:
 *  1. Visitors see the owner's replacement wording (Customize > click any text). It runs after hydration, so it
 *     never causes a hydration mismatch; search engines still read the original HTML.
 *  2. Inside the Customize preview only, every piece of text is clickable: the click asks the editor to open that
 *     text, and drafts typed there show instantly (BIZNEST_TEXT_DRAFT).
 * Text is matched by its visible content (whitespace collapsed), so one change covers every place it appears.
 */

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE", "SVG", "TITLE", "HEAD"]);
const NEUTRAL = new Set(["SVG", "IMG", "BR", "I", "PICTURE", "SOURCE", "HR"]);

type Unit = { key: string; nodes: Text[]; el: Element };
type State = { orig: string; raw: string; applied: string | null };

function ownText(el: Element): Text[] {
  const out: Text[] = [];
  for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && normalizeText(n.nodeValue ?? "") !== "") out.push(n as Text);
  return out;
}

/** An element is one editable unit when its only children are text and harmless things like icons. */
function isLeaf(el: Element): boolean {
  for (const c of Array.from(el.children)) {
    if (NEUTRAL.has(c.tagName.toUpperCase())) continue;
    if (c.tagName.toUpperCase() === "I" && !(c.textContent ?? "").trim()) continue;
    return false;
  }
  return true;
}

function skipped(el: Element): boolean {
  return !!el.closest("[data-bn-edit],[data-bn-no-edit],[contenteditable='true']") || SKIP.has(el.tagName.toUpperCase());
}

function collect(root: Element, out: Unit[]) {
  if (skipped(root)) return;
  if (isLeaf(root)) {
    const nodes = ownText(root);
    if (nodes.length) out.push({ key: normalizeText(nodes.map((n) => n.nodeValue ?? "").join(" ")), nodes, el: root });
    return;
  }
  for (const n of Array.from(root.childNodes)) {
    if (n.nodeType === 3) {
      const t = n as Text;
      if (normalizeText(t.nodeValue ?? "") !== "") out.push({ key: normalizeText(t.nodeValue ?? ""), nodes: [t], el: root });
    } else if (n.nodeType === 1) collect(n as Element, out);
  }
}

function inOwnPreview(): boolean {
  try {
    if (window.self === window.top) return false;
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function StoreTextOverrides({ overrides }: { overrides: TextOverrides }) {
  useEffect(() => {
    if (/\/admin(\/|$)/.test(window.location.pathname)) return; // never reword the dashboard
    const preview = inOwnPreview();
    const saved = overrides;
    let drafts: Record<string, string> = {};
    let editOn = true;
    const state = new WeakMap<Text, State>();
    let raf = 0;

    const effective = (key: string): string | undefined => {
      const v = key in drafts ? drafts[key] : saved[key];
      return v && v.trim() ? v : undefined;
    };

    /** The text this unit had before we touched it (so clicking a reworded text still finds its override). */
    function originalOf(u: Unit): string {
      const st = state.get(u.nodes[0]);
      const current = u.key;
      if (st && st.applied !== null && normalizeText(st.applied) === current) return st.orig;
      return current;
    }

    function apply() {
      raf = 0;
      const units: Unit[] = [];
      collect(document.body, units);
      for (const u of units) {
        const first = u.nodes[0];
        const st = state.get(first);
        const ours = !!st && st.applied !== null && normalizeText(st.applied) === u.key && normalizeText(first.nodeValue ?? "") === u.key; // still the text we set
        const orig = ours ? st!.orig : u.key;
        const raw = ours ? st!.raw : (first.nodeValue ?? "");
        const want = effective(orig);
        if (want !== undefined && normalizeText(want) !== orig) {
          const lead = raw.match(/^\s*/)?.[0] ?? "";
          const trail = u.nodes.length > 1 ? "" : raw.match(/\s*$/)?.[0] ?? "";
          if (!ours || st!.applied !== want) {
            first.nodeValue = lead + want + trail;
            for (let i = 1; i < u.nodes.length; i++) u.nodes[i].nodeValue = "";
          }
          state.set(first, { orig, raw, applied: want });
        } else if (ours) {
          first.nodeValue = raw; // the override was removed: put the original back
          state.set(first, { orig, raw, applied: null });
        } else if (st && st.applied !== null) {
          state.set(first, { orig: u.key, raw: first.nodeValue ?? "", applied: null }); // React rewrote the text: it is a new original
        }
      }
    }
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(apply); };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    let cleanup = () => {};
    if (preview) {
      const style = document.createElement("style");
      style.textContent = `body[data-bn-textedit] *:not(svg *):hover{cursor:pointer}[data-bn-textedit-hover]{outline:2px dashed #16a34a!important;outline-offset:2px;background-color:rgba(22,163,74,.08)!important}`;
      document.head.appendChild(style);
      document.body.setAttribute("data-bn-textedit", "");

      let hovered: Element | null = null;
      const unitOf = (el: Element, only?: Text): Unit | null => {
        if (skipped(el)) return null;
        if (isLeaf(el)) {
          const nodes = ownText(el);
          return nodes.length ? { key: normalizeText(nodes.map((n) => n.nodeValue ?? "").join(" ")), nodes, el } : null;
        }
        return only && normalizeText(only.nodeValue ?? "") !== "" ? { key: normalizeText(only.nodeValue ?? ""), nodes: [only], el } : null;
      };
      const unitAt = (target: EventTarget | null, x: number, y: number): Unit | null => {
        const el = target instanceof Element ? target : null;
        if (!el || skipped(el)) return null;
        // Builder-home sections already select the whole section in the editor when clicked.
        if (el.closest("[data-bn-type]")) return null;
        const anyDoc = document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null };
        const hit = anyDoc.caretRangeFromPoint?.(x, y)?.startContainer ?? anyDoc.caretPositionFromPoint?.(x, y)?.offsetNode ?? null;
        if (hit && hit.nodeType === 3 && hit.parentElement && el.contains(hit)) {
          const u = unitOf(hit.parentElement, hit as Text);
          if (u) return u;
        }
        for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) {
          const u = unitOf(cur);
          if (u) return u;
        }
        return null;
      };
      const onMove = (e: MouseEvent) => {
        if (!editOn) return;
        const u = unitAt(e.target, e.clientX, e.clientY);
        const next = u?.el ?? null;
        if (next === hovered) return;
        hovered?.removeAttribute("data-bn-textedit-hover");
        hovered = next;
        hovered?.setAttribute("data-bn-textedit-hover", "");
      };
      const onClick = (e: MouseEvent) => {
        if (!editOn) return;
        const u = unitAt(e.target, e.clientX, e.clientY);
        if (!u) return;
        e.preventDefault();
        e.stopPropagation();
        const original = originalOf(u);
        const current = effective(original) ?? original;
        window.parent?.postMessage({ type: "BIZNEST_CUSTOMIZER_EDIT_TEXT", original, current }, window.location.origin);
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        const d = event.data;
        if (!d) return;
        if (d.type === "BIZNEST_TEXT_DRAFT" && typeof d.original === "string") {
          drafts = { ...drafts, [normalizeText(d.original)]: typeof d.value === "string" ? d.value : "" };
          schedule();
        } else if (d.type === "BIZNEST_TEXT_EDIT_MODE") {
          editOn = !!d.on;
          document.body.toggleAttribute("data-bn-textedit", editOn);
          if (!editOn) { hovered?.removeAttribute("data-bn-textedit-hover"); hovered = null; }
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      window.addEventListener("message", onMessage);
      cleanup = () => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("click", onClick, true);
        window.removeEventListener("message", onMessage);
        style.remove();
        document.body.removeAttribute("data-bn-textedit");
        hovered?.removeAttribute("data-bn-textedit-hover");
      };
    }

    return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); cleanup(); };
  }, [overrides]);

  return null;
}
