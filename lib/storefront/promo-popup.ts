// Shared (server + client safe) config, sanitizer and theme helper for the
// storefront promotional pop-up card. Stored in Store.storefrontConfig.promoPopup
// (a JSON field) so no schema migration is needed. No prisma imports here on
// purpose so the client component can import types/helpers.

import { MENU_PAGE_OPTIONS, storePath } from "@/lib/storefront-menu";
import { SIGNATURE_DEDICATED_RENDERER } from "@/lib/storefront/signature-renderers";
import type { TemplateTheme } from "@/lib/template-themes";

export type PromoLayout = "center" | "split" | "corner";
export type PromoTrigger = "delay" | "scroll" | "exit";
export type PromoFrequency = "always" | "session" | "daily" | "weekly" | "once";

export type PromoPopupConfig = {
  enabled: boolean;
  layout: PromoLayout;
  trigger: PromoTrigger;
  delaySeconds: number;
  frequency: PromoFrequency;
  eyebrow: string;
  headline: string;
  body: string;
  imageUrl: string;
  couponCode: string;
  ctaLabel: string;
  /** "" = no button, "/catalog" = store page, "https://…" = external. */
  ctaTarget: string;
  /** ISO date string; popup stops showing after this. Empty = never expires. */
  endsAt: string;
  /** Bumped on every save so visitors who dismissed an old promo see the new one. */
  version: number;
};

export const DEFAULT_PROMO_POPUP: PromoPopupConfig = {
  enabled: false,
  layout: "center",
  trigger: "delay",
  delaySeconds: 6,
  frequency: "daily",
  eyebrow: "Limited offer",
  headline: "Get 10% off your first order",
  body: "Use the code below at checkout. Offer ends soon.",
  imageUrl: "",
  couponCode: "",
  ctaLabel: "Shop now",
  ctaTarget: "/catalog",
  endsAt: "",
  version: 1,
};

/** Palette the popup actually needs — a subset of TemplateTheme. */
export type PromoPalette = Pick<
  TemplateTheme,
  "bg" | "ink" | "card" | "accent" | "font" | "headlineFont" | "radius"
> & { muted: string; border: string; accentSoft: string };

const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : fallback;

/** Only http(s) images and Cloudinary-style URLs; blocks javascript:/data: etc. */
function safeUrl(v: unknown): string {
  const s = str(v, 600);
  return /^https:\/\//i.test(s) ? s : "";
}

function safeTarget(v: unknown): string {
  const s = str(v, 600);
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "";
}

/** Coerces any stored/posted JSON into a valid config. Never throws. */
export function sanitizePromoPopup(raw: unknown): PromoPopupConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PROMO_POPUP;
  const delay = Number(r.delaySeconds);
  const version = Number(r.version);
  const endsAt = str(r.endsAt, 40);
  return {
    enabled: r.enabled === true,
    layout: oneOf(r.layout, ["center", "split", "corner"] as const, d.layout),
    trigger: oneOf(r.trigger, ["delay", "scroll", "exit"] as const, d.trigger),
    delaySeconds: Number.isFinite(delay) ? Math.min(120, Math.max(0, Math.round(delay))) : d.delaySeconds,
    frequency: oneOf(r.frequency, ["always", "session", "daily", "weekly", "once"] as const, d.frequency),
    eyebrow: str(r.eyebrow, 40, d.eyebrow),
    headline: str(r.headline, 90, d.headline),
    body: str(r.body, 240, d.body),
    imageUrl: safeUrl(r.imageUrl),
    couponCode: str(r.couponCode, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
    ctaLabel: str(r.ctaLabel, 28, d.ctaLabel),
    ctaTarget: safeTarget(r.ctaTarget),
    endsAt: Number.isNaN(Date.parse(endsAt)) ? "" : endsAt,
    version: Number.isFinite(version) && version > 0 ? Math.round(version) : d.version,
  };
}

export function readPromoPopup(storefrontConfig: unknown): PromoPopupConfig {
  const cfg = storefrontConfig && typeof storefrontConfig === "object" ? (storefrontConfig as Record<string, unknown>) : {};
  return sanitizePromoPopup(cfg.promoPopup);
}

export function isPromoLive(c: PromoPopupConfig, now = Date.now()): boolean {
  if (!c.enabled || !c.headline) return false;
  if (c.endsAt && Date.parse(c.endsAt) < now) return false;
  return true;
}

export function resolvePromoHref(slug: string, target: string): { href: string; external: boolean } | null {
  if (!target) return null;
  if (/^https:\/\//i.test(target)) return { href: target, external: true };
  return { href: storePath(slug, target), external: false };
}

export const PROMO_TARGET_OPTIONS = MENU_PAGE_OPTIONS.filter((p) =>
  ["/", "/catalog", "/rooms", "/services", "/book", "/reservations", "/offers", "/deals", "/new-arrivals", "/pricing", "/contact", "/dining"].includes(p.path)
);

// The three dedicated signature renderers paint their own inline palettes in
// app/store/[slug]/page.tsx (see renderStorefront). Mirror them here so the
// popup matches what the visitor actually sees, not the catalog theme.
const DEDICATED_PALETTES: Record<string, Omit<PromoPalette, "font" | "radius">> = {
  belora: { accent: "#7B4BC0", bg: "#F1EAF8", ink: "#2B2430", card: "#FFFFFF", muted: "#837B89", border: "#E8E0EF", accentSoft: "#D5B7EA", headlineFont: "Georgia, serif" },
  "grand-vere": { accent: "#0E5B45", bg: "#FFFFFF", ink: "#15392C", card: "#FFFFFF", muted: "#777777", border: "#E6E1D7", accentSoft: "#C8BEA7", headlineFont: "Georgia, serif" },
  "great-treasure": { accent: "#E7A928", bg: "#07100D", ink: "#F7F3EA", card: "#101815", muted: "#B9B6AF", border: "#2C362F", accentSoft: "#6D5420", headlineFont: "Georgia, serif" },
};

export function buildPromoPalette(theme: TemplateTheme, templateName: string | null | undefined): PromoPalette {
  const dedicated = templateName ? DEDICATED_PALETTES[SIGNATURE_DEDICATED_RENDERER[templateName] ?? ""] : undefined;
  const t = dedicated ? { ...theme, ...dedicated } : theme;
  return {
    bg: t.bg,
    ink: t.ink,
    card: t.card,
    accent: t.accent,
    font: t.font,
    headlineFont: t.headlineFont,
    radius: t.radius,
    muted: t.muted ?? t.ink,
    border: t.border ?? "rgba(128,128,128,0.25)",
    accentSoft: t.accentSoft ?? t.accent,
  };
}

/** Routes where an interruption would hurt: money, auth, owner tools. */
const BLOCKED_SEGMENTS = new Set([
  "admin", "checkout", "cart", "payment", "wallet-pay", "account", "orders", "review", "staff",
]);

/** pathname may be /store/<slug>/… or /<slug>/… (path-based store URLs). */
export function isPromoRouteAllowed(pathname: string, slug: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "store") parts.shift();
  if (parts[0] === slug) parts.shift();
  return !parts.some((p) => BLOCKED_SEGMENTS.has(p));
}
