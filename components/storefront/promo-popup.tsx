"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  isPromoLive,
  isPromoRouteAllowed,
  resolvePromoHref,
  type PromoPalette,
  type PromoPopupConfig,
} from "@/lib/storefront/promo-popup";

/**
 * Presentational card. Styled entirely from the store's resolved template
 * palette (font, radius, colors), so one component looks native in every
 * template — light, dark, serif or sans — without per-template forks.
 * Also used statically for the dashboard preview.
 */
export function PromoCard({
  config,
  palette,
  slug,
  onClose,
  onCta,
  static: isStatic = false,
}: {
  config: PromoPopupConfig;
  palette: PromoPalette;
  slug: string;
  onClose?: () => void;
  onCta?: () => void;
  static?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const link = resolvePromoHref(slug, config.ctaTarget);
  const split = config.layout === "split";
  const hasImage = !!config.imageUrl;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(config.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be blocked (iframe/permissions); the code stays visible to copy by hand */
    }
  };

  const style = {
    "--pp-bg": palette.card,
    "--pp-ink": palette.ink,
    "--pp-muted": palette.muted,
    "--pp-border": palette.border,
    "--pp-accent": palette.accent,
    "--pp-soft": palette.accentSoft,
    "--pp-radius": palette.radius,
    fontFamily: palette.font,
  } as React.CSSProperties;

  // Pick readable text on the accent color (accent can be lime, black, purple...).
  const onAccent = readableOn(palette.accent);

  return (
    <div
      style={style}
      className={[
        "relative overflow-hidden border shadow-2xl",
        "bg-[var(--pp-bg)] text-[var(--pp-ink)] border-[var(--pp-border)] rounded-[var(--pp-radius)]",
        split && hasImage ? "grid w-full sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" : "w-full",
      ].join(" ")}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close promotion"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.imageUrl}
          alt=""
          loading="lazy"
          className={split ? "h-44 w-full object-cover sm:h-full sm:min-h-[320px]" : "h-36 w-full object-cover sm:h-44"}
        />
      )}

      <div className={split && hasImage ? "flex flex-col justify-center p-6 sm:p-8" : "p-6"}>
        {config.eyebrow && (
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--pp-accent)" }}
          >
            {config.eyebrow}
          </p>
        )}
        <h2
          className="text-2xl font-bold leading-tight"
          style={{ fontFamily: palette.headlineFont }}
        >
          {config.headline}
        </h2>
        {config.body && (
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--pp-muted)" }}>
            {config.body}
          </p>
        )}

        {config.couponCode && (
          <button
            type="button"
            onClick={copy}
            className="mt-4 flex w-full items-center justify-between gap-3 border border-dashed px-4 py-3 text-left focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: "var(--pp-accent)",
              background: "color-mix(in srgb, var(--pp-accent) 8%, transparent)",
              borderRadius: "calc(var(--pp-radius) * 0.6)",
            }}
            aria-label={`Copy code ${config.couponCode}`}
          >
            <span className="font-mono text-base font-bold tracking-widest">{config.couponCode}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--pp-accent)" }} aria-live="polite">
              {copied ? "Copied" : "Tap to copy"}
            </span>
          </button>
        )}

        {link && config.ctaLabel && (
          <a
            href={link.href}
            onClick={isStatic ? (e) => e.preventDefault() : onCta}
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-4 block px-5 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2"
            style={{
              background: "var(--pp-accent)",
              color: onAccent,
              borderRadius: "calc(var(--pp-radius) * 0.6)",
            }}
          >
            {config.ctaLabel}
          </a>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--pp-muted)" }}
          >
            No thanks
          </button>
        )}
      </div>
    </div>
  );
}

function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#111" : "#fff";
}

const DAY = 24 * 60 * 60 * 1000;

/** Returns true if the visitor should NOT see the popup right now. */
function isSuppressed(key: string, c: PromoPopupConfig): boolean {
  try {
    if (c.frequency === "always") return false;
    if (c.frequency === "session") return sessionStorage.getItem(key) === String(c.version);
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const { v, t } = JSON.parse(raw) as { v: number; t: number };
    if (v !== c.version) return false; // owner changed the promo → show again
    if (c.frequency === "once") return true;
    return Date.now() - t < (c.frequency === "daily" ? DAY : 7 * DAY);
  } catch {
    return false; // storage blocked → fail open, but dismissals still work in-memory
  }
}

function remember(key: string, c: PromoPopupConfig) {
  try {
    if (c.frequency === "session") sessionStorage.setItem(key, String(c.version));
    else if (c.frequency !== "always") localStorage.setItem(key, JSON.stringify({ v: c.version, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function PromoPopup({
  slug,
  config,
  palette,
}: {
  slug: string;
  config: PromoPopupConfig;
  palette: PromoPalette;
}) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const dismissedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const key = `bn-promo:${slug}`;
  const allowed = isPromoRouteAllowed(pathname, slug) && isPromoLive(config);

  const close = useCallback(() => {
    dismissedRef.current = true;
    setOpen(false);
    remember(key, config);
  }, [key, config]);

  // Trigger logic
  useEffect(() => {
    if (!allowed || dismissedRef.current || isSuppressed(key, config)) return;
    const show = () => {
      if (!dismissedRef.current) setOpen(true);
    };
    const cleanups: Array<() => void> = [];
    const touch = window.matchMedia?.("(hover: none)").matches;

    if (config.trigger === "delay" || (config.trigger === "exit" && touch)) {
      // Exit-intent has no signal on touch devices, so fall back to a timer.
      const ms = config.trigger === "exit" ? 15000 : config.delaySeconds * 1000;
      const t = window.setTimeout(show, ms);
      cleanups.push(() => clearTimeout(t));
    } else if (config.trigger === "scroll") {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max > 0.4) show();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    } else {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) show();
      };
      document.addEventListener("mouseleave", onLeave);
      cleanups.push(() => document.removeEventListener("mouseleave", onLeave));
    }
    return () => cleanups.forEach((fn) => fn());
  }, [allowed, config, key]);

  // Hide if the visitor navigates onto a blocked route (e.g. into checkout) while open.
  useEffect(() => {
    if (open && !allowed) setOpen(false);
  }, [open, allowed]);

  // Esc to close, focus management, scroll lock for modal layouts
  useEffect(() => {
    if (!open) return;
    const modal = config.layout !== "corner";
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (modal) document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, config.layout, close]);

  if (!open || !allowed) return null;

  const corner = config.layout === "corner";
  const width = config.layout === "split" ? "max-w-3xl" : "max-w-md";

  return (
    <div
      className={corner ? "pointer-events-none fixed inset-x-0 bottom-0 z-[80] p-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:p-0" : "fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6"}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {!corner && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={!corner}
        aria-label={config.headline}
        tabIndex={-1}
        className={`pointer-events-auto relative w-full ${corner ? "sm:w-[360px]" : width} max-h-[92vh] overflow-y-auto focus:outline-none`}
        style={{ borderRadius: palette.radius }}
      >
        <PromoCard config={config} palette={palette} slug={slug} onClose={close} onCta={close} />
      </div>
    </div>
  );
}
