"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ShoppingBag } from "lucide-react";

/**
 * Landing-page demo of what a BizNest storefront feels like: products hang on a rail and sway, the rail
 * scrolls sideways (drag, swipe, arrow keys), and choosing one lifts it out of the rail into a product view.
 * Everything is sample data drawn in CSS and SVG, so it needs no images and matches the brand exactly.
 * Styles live in app/landing-motion.css under the `bn-rail` prefix.
 */

type Item = { id: string; name: string; price: string; blurb: string; sizes: string[]; hue: number };

const ITEMS: Item[] = [
  { id: "tote", name: "Woven tote bag", price: "₦18,500", blurb: "Hand-woven raffia with a leather strap. Fits a laptop and lunch.", sizes: ["One size"], hue: 150 },
  { id: "dress", name: "Ankara wrap dress", price: "₦32,000", blurb: "Cotton wax print, tied at the waist. Made to order in three days.", sizes: ["S", "M", "L", "XL"], hue: 28 },
  { id: "earrings", name: "Beaded earrings", price: "₦6,200", blurb: "Glass beads on brass hooks. Light enough to wear all day.", sizes: ["One size"], hue: 335 },
  { id: "shirt", name: "Adire shirt", price: "₦24,000", blurb: "Indigo tie-dye on soft cotton. Every piece is dyed by hand, so no two match.", sizes: ["S", "M", "L", "XL"], hue: 215 },
  { id: "sandals", name: "Leather slides", price: "₦15,800", blurb: "Vegetable-tanned leather that softens as you wear it.", sizes: ["40", "41", "42", "43", "44"], hue: 40 },
];

function Art({ id }: { id: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden="true">
      {id === "tote" && (
        <g {...common}>
          <path d="M18 30h44l4 36H14z" />
          <path d="M28 30v-6a12 12 0 0 1 24 0v6" />
        </g>
      )}
      {id === "dress" && (
        <g {...common}>
          <path d="M30 12l10 8 10-8 6 14-8 6 10 38H22l10-38-8-6z" />
          <path d="M32 32h16" />
        </g>
      )}
      {id === "earrings" && (
        <g {...common}>
          <path d="M26 14v12M54 14v12" />
          <circle cx="26" cy="36" r="8" />
          <circle cx="54" cy="36" r="8" />
          <circle cx="26" cy="56" r="3.5" />
          <circle cx="54" cy="56" r="3.5" />
        </g>
      )}
      {id === "shirt" && (
        <g {...common}>
          <path d="M30 14l-16 10 6 12 8-4v38h24V32l8 4 6-12-16-10" />
          <path d="M30 14c2 6 18 6 20 0" />
        </g>
      )}
      {id === "sandals" && (
        <g {...common}>
          <path d="M10 56c0-6 4-8 10-8h22l16 4c6 2 12 4 12 10v2H10z" />
          <path d="M26 48c0-8 8-14 16-12" />
        </g>
      )}
    </svg>
  );
}

function tileBackground(hue: number) {
  return `radial-gradient(120% 90% at 30% 15%, hsl(${hue} 55% 48% / 0.55), transparent 62%), linear-gradient(160deg, hsl(${hue} 40% 20%), hsl(${hue} 45% 11%))`;
}

export function StorefrontRailDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [cart, setCart] = useState(0);
  const [added, setAdded] = useState(false);
  const [bump, setBump] = useState(0);
  const [live, setLive] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const current = ITEMS.find((i) => i.id === open) ?? null;

  // Start the drop-in once the demo is on screen. Without JS or with reduced motion, `live` stays false and
  // the CSS shows everything at rest.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setLive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLive(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function choose(id: string) {
    if (drag.current?.moved) return; // the pointer was dragging the rail, not choosing
    setOpen(id);
    setSize(null);
    setAdded(false);
  }

  function close() {
    setOpen(null);
    setAdded(false);
  }

  function addToCart() {
    if (!current) return;
    if (current.sizes.length > 1 && !size) return;
    setCart((c) => c + 1);
    setBump((b) => b + 1);
    setAdded(true);
  }

  // Mouse drag on the rail. Touch uses the browser's own horizontal scrolling.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !railRef.current) return;
    drag.current = { x: e.clientX, left: railRef.current.scrollLeft, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || !railRef.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) railRef.current.scrollLeft = d.left - dx;
  }
  function onPointerUp() {
    // Clear after the click event that follows has been handled.
    setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  const needsSize = !!current && current.sizes.length > 1 && !size;

  return (
    <div
      ref={rootRef}
      className="bn-rail mx-auto w-full max-w-xl overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
      data-live={live || undefined}
      data-open={open ? "" : undefined}
      style={{ border: "1px solid var(--bn-ink-line)", background: "var(--bn-ink-raised)" }}
      role="group"
      aria-label="Sample storefront. Choose a product to open it."
    >
      {/* browser chrome */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--bn-ink-line)" }}>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e2645a" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e6b34f" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#34d399" }} />
        </div>
        <div
          className="flex-1 truncate rounded-full px-3 py-1 text-center text-[11px]"
          style={{ background: "var(--bn-ink)", color: "var(--bn-mute)", fontFamily: "var(--font-mono)" }}
        >
          biznest.space/stacey{current ? `/${current.id}` : ""}
        </div>
      </div>

      <div className="relative p-4 sm:p-5">
        {/* store header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: "var(--bn-ivory)", fontFamily: "var(--font-display)" }}>
            Stacey&apos;s Paradise
          </span>
          <span
            key={bump}
            className="bn-rail-cart inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{ background: "var(--bn-accent-gradient)", color: "var(--bn-ivory)" }}
          >
            <ShoppingBag className="h-3 w-3" aria-hidden="true" />
            Cart · {cart}
          </span>
        </div>

        <div className="bn-rail-stage relative">
          {/* the rail */}
          <div className="bn-rail-view" aria-hidden={current ? true : undefined}>
            <p className="mb-2 text-[11px]" style={{ color: "var(--bn-mute)", fontFamily: "var(--font-mono)" }}>
              New in · drag to browse
            </p>
            <div className="bn-rail-bar" aria-hidden="true" />
            <div
              ref={railRef}
              className="bn-rail-track"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              tabIndex={current ? -1 : 0}
              role="list"
              aria-label="Products"
            >
              {ITEMS.map((it, i) => (
                <div key={it.id} role="listitem" className="bn-rail-slot" style={{ ["--i" as string]: i }}>
                  <span className="bn-rail-hook" aria-hidden="true" />
                  <button
                    type="button"
                    className="bn-rail-card"
                    onClick={() => choose(it.id)}
                    tabIndex={current ? -1 : 0}
                    aria-label={`${it.name}, ${it.price}`}
                  >
                    <span className="bn-rail-art" style={{ background: tileBackground(it.hue), color: `hsl(${it.hue} 70% 82%)` }}>
                      <Art id={it.id} />
                    </span>
                    <span className="mt-1.5 block truncate text-left text-[11px] font-medium" style={{ color: "var(--bn-ivory)" }}>
                      {it.name}
                    </span>
                    <span className="block text-left text-[10px]" style={{ color: "var(--bn-mute)", fontFamily: "var(--font-mono)" }}>
                      {it.price}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* the product view, lifted out of the rail */}
          <div className="bn-rail-detail" aria-hidden={current ? undefined : true}>
            {current && (
              <>
                <button
                  type="button"
                  onClick={close}
                  className="mb-3 inline-flex items-center gap-1.5 text-[11px] transition hover:opacity-100"
                  style={{ color: "var(--bn-accent-text)" }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to the rail
                </button>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-4">
                  <div
                    className="bn-rail-hero aspect-[4/5] rounded-xl p-6"
                    style={{ background: tileBackground(current.hue), color: `hsl(${current.hue} 70% 82%)`, border: "1px solid var(--bn-ink-line)" }}
                  >
                    <Art id={current.id} />
                  </div>
                  <div className="bn-rail-info">
                    <p className="text-base font-semibold leading-tight" style={{ color: "var(--bn-ivory)", fontFamily: "var(--font-display)" }}>
                      {current.name}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--bn-accent-text)", fontFamily: "var(--font-mono)" }}>
                      {current.price}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--bn-mute)" }}>
                      {current.blurb}
                    </p>
                    {current.sizes.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
                        {current.sizes.map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={size === s}
                            onClick={() => {
                              setSize(s);
                              setAdded(false);
                            }}
                            className="bn-rail-size rounded-full px-2.5 py-1 text-[10px]"
                            data-on={size === s || undefined}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addToCart}
                      aria-disabled={needsSize || undefined}
                      className="bn-cta mt-4 w-full justify-center rounded-full px-4 py-2 text-xs font-medium"
                      style={{ background: "var(--bn-accent-text)", color: "var(--bn-ink)", opacity: needsSize ? 0.55 : 1 }}
                    >
                      {added ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Added to cart
                        </>
                      ) : needsSize ? (
                        "Choose a size"
                      ) : (
                        "Add to cart"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
