/**
 * Browser-side storefront tracking: GA4, Meta Pixel and Plausible.
 *
 * Import only from client components. Every function is a safe no-op on the
 * server or when the current store has no tracking configured.
 *
 * Design notes
 * - One registry (window.__bnTracking) says which store's IDs are active. It is
 *   set by <StoreTracking> in the storefront layout and cleared when that
 *   unmounts. Every event is addressed to an explicit ID (gtag `send_to`,
 *   fbq `trackSingle`, Plausible `domain`) and only for the store the event
 *   belongs to. Why: BizNest is a SPA, so a shopper can soft-navigate from
 *   store A to store B without a page reload, and the third-party scripts
 *   from store A are still alive in `window`. Without this, store B's
 *   add-to-cart could be reported into store A's analytics.
 * - Plausible is called through its public Events API instead of its script
 *   tag, for the same reason: the script bakes one domain in at load time.
 * - Nothing here ever receives or sends customer names, emails or phone
 *   numbers. Events carry product ids/names, prices and order ids only.
 */
import { isTrackablePath } from "@/lib/tracking/ids";

export type TrackItem = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  variant?: string | null;
};

export type TrackEvent =
  | { type: "view_item"; currency: string; item: TrackItem }
  | { type: "add_to_cart"; currency: string; item: TrackItem }
  | { type: "begin_checkout"; currency: string; value: number; items: TrackItem[] }
  | { type: "purchase"; currency: string; value: number; transactionId: string; items: TrackItem[] }
  // A booking/reservation request that is not (yet) paid online.
  | { type: "booking_request"; currency: string; value: number; transactionId: string; name?: string };

export type ActiveTracking = {
  slug: string;
  gaId: string | null;
  metaPixelId: string | null;
  plausibleDomain: string | null;
};

type GtagFn = (...args: unknown[]) => void;
type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    __bnTracking?: ActiveTracking;
    dataLayer?: unknown[];
    gtag?: GtagFn;
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

const PLAUSIBLE_ENDPOINT = "https://plausible.io/api/event";

const injectedScripts = new Set<string>();
const gaConfigured = new Set<string>();
const metaInitialised = new Set<string>();

function injectScript(src: string, key: string) {
  if (injectedScripts.has(key)) return;
  injectedScripts.add(key);
  if (document.querySelector(`script[data-bn-track="${key}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  s.dataset.bnTrack = key;
  document.head.appendChild(s);
}

/* ------------------------------ registry ------------------------------ */

export function registerTracking(cfg: ActiveTracking): () => void {
  if (typeof window === "undefined") return () => {};
  window.__bnTracking = cfg;
  if (cfg.gaId) ensureGa(cfg.gaId);
  if (cfg.metaPixelId) ensureMeta(cfg.metaPixelId);
  return () => {
    // Only clear our own registration: on a store-to-store soft navigation the
    // incoming store may already have registered itself.
    if (window.__bnTracking === cfg) window.__bnTracking = undefined;
  };
}

/* ------------------------------ GA4 ------------------------------ */

function ensureGa(id: string) {
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    // gtag.js requires the real `arguments` object (not a rest array) on the dataLayer.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer as unknown[]).push(arguments);
    };
    window.gtag("js", new Date());
  }
  if (gaConfigured.has(id)) return;
  gaConfigured.add(id);
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, `ga:${id}`);
  // Page views are sent manually (see trackPageView) so client-side route
  // changes are counted exactly once, regardless of GA's enhanced-measurement settings.
  window.gtag("config", id, { send_page_view: false });
}

/* ------------------------------ Meta Pixel ------------------------------ */

function ensureMeta(id: string) {
  if (!window.fbq) {
    // Mirrors Meta's official bootstrap snippet (queue until fbevents.js loads).
    const n = function () {
      // eslint-disable-next-line prefer-rest-params
      n.callMethod ? n.callMethod.apply(n, arguments as unknown as unknown[]) : n.queue.push(arguments);
    } as FbqFn;
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    injectScript("https://connect.facebook.net/en_US/fbevents.js", "meta");
  }
  if (metaInitialised.has(id)) return;
  metaInitialised.add(id);
  // Turn off Meta's "automatic configuration" (scraping form fields for
  // advanced matching, auto button-click events). Must come before init.
  // Keeps the promise that customer names/emails/phones never leave via the pixel.
  window.fbq("set", "autoConfig", false, id);
  window.fbq("init", id);
}

/* ------------------------------ Plausible ------------------------------ */

function plausibleDisabled(): boolean {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
  try {
    // Plausible's documented way for a person to exclude their own browser.
    if (localStorage.getItem("plausible_ignore") === "true") return true;
  } catch {
    /* storage blocked: carry on */
  }
  return false;
}

function plausibleSend(
  domain: string,
  name: string,
  extra?: { props?: Record<string, string | number>; revenue?: { currency: string; amount: number }; referrer?: string | null }
) {
  if (plausibleDisabled()) return;
  try {
    void fetch(PLAUSIBLE_ENDPOINT, {
      method: "POST",
      // text/plain keeps this a "simple" request (no CORS preflight), same as Plausible's own script.
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      body: JSON.stringify({
        name,
        url: location.href,
        domain,
        ...(extra?.referrer ? { referrer: extra.referrer } : {}),
        ...(extra?.props ? { props: extra.props } : {}),
        ...(extra?.revenue ? { revenue: extra.revenue } : {}),
      }),
    }).catch(() => {});
  } catch {
    /* tracking must never break the storefront */
  }
}

/* ------------------------------ public API ------------------------------ */

function active(slug: string): ActiveTracking | null {
  if (typeof window === "undefined") return null;
  const cfg = window.__bnTracking;
  if (!cfg || cfg.slug !== slug) return null;
  if (!isTrackablePath(location.pathname)) return null;
  return cfg;
}

let lastPageViewKey = "";

/** Call on first load and on every client-side route change. De-duplicated per URL. */
export function trackPageView(slug: string, isFirstLoad: boolean) {
  const cfg = active(slug);
  if (!cfg) return;
  const key = `${slug}|${location.pathname}${location.search}`;
  if (key === lastPageViewKey) return;
  lastPageViewKey = key;
  try {
    if (cfg.gaId && window.gtag) window.gtag("event", "page_view", { send_to: cfg.gaId });
    if (cfg.metaPixelId && window.fbq) window.fbq("trackSingle", cfg.metaPixelId, "PageView");
    if (cfg.plausibleDomain) {
      plausibleSend(cfg.plausibleDomain, "pageview", { referrer: isFirstLoad ? document.referrer || null : null });
    }
  } catch {
    /* never break the page */
  }
}

const gaItem = (i: TrackItem) => ({
  item_id: i.id,
  item_name: i.name,
  price: i.price,
  quantity: i.quantity ?? 1,
  ...(i.variant ? { item_variant: i.variant } : {}),
});

export function trackEvent(slug: string, e: TrackEvent) {
  const cfg = active(slug);
  if (!cfg) return;
  try {
    if (cfg.gaId && window.gtag) sendGa(cfg.gaId, e);
    if (cfg.metaPixelId && window.fbq) sendMeta(cfg.metaPixelId, e);
    if (cfg.plausibleDomain) sendPlausible(cfg.plausibleDomain, e);
  } catch {
    /* never break the page */
  }
}

function sendGa(id: string, e: TrackEvent) {
  const gtag = window.gtag!;
  switch (e.type) {
    case "view_item":
      return gtag("event", "view_item", { send_to: id, currency: e.currency, value: e.item.price, items: [gaItem(e.item)] });
    case "add_to_cart":
      return gtag("event", "add_to_cart", { send_to: id, currency: e.currency, value: e.item.price * (e.item.quantity ?? 1), items: [gaItem(e.item)] });
    case "begin_checkout":
      return gtag("event", "begin_checkout", { send_to: id, currency: e.currency, value: e.value, items: e.items.map(gaItem) });
    case "purchase":
      return gtag("event", "purchase", { send_to: id, transaction_id: e.transactionId, currency: e.currency, value: e.value, items: e.items.map(gaItem) });
    case "booking_request":
      return gtag("event", "generate_lead", { send_to: id, currency: e.currency, value: e.value });
  }
}

function sendMeta(id: string, e: TrackEvent) {
  const fbq = window.fbq!;
  const contents = (items: TrackItem[]) => items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1 }));
  switch (e.type) {
    case "view_item":
      return fbq("trackSingle", id, "ViewContent", { content_ids: [e.item.id], content_name: e.item.name, content_type: "product", value: e.item.price, currency: e.currency });
    case "add_to_cart":
      return fbq("trackSingle", id, "AddToCart", { content_ids: [e.item.id], content_name: e.item.name, content_type: "product", contents: contents([e.item]), value: e.item.price * (e.item.quantity ?? 1), currency: e.currency });
    case "begin_checkout":
      return fbq("trackSingle", id, "InitiateCheckout", { content_ids: e.items.map((i) => i.id), content_type: "product", contents: contents(e.items), num_items: e.items.reduce((n, i) => n + (i.quantity ?? 1), 0), value: e.value, currency: e.currency });
    case "purchase":
      // eventID lets Meta de-duplicate if a server-side (Conversions API) feed is added later.
      return fbq("trackSingle", id, "Purchase", { content_ids: e.items.map((i) => i.id), content_type: "product", contents: contents(e.items), num_items: e.items.reduce((n, i) => n + (i.quantity ?? 1), 0), value: e.value, currency: e.currency }, { eventID: e.transactionId });
    case "booking_request":
      return fbq("trackSingle", id, "Schedule", { value: e.value, currency: e.currency }, { eventID: e.transactionId });
  }
}

function sendPlausible(domain: string, e: TrackEvent) {
  switch (e.type) {
    case "view_item":
      return plausibleSend(domain, "View Item", { props: { item: e.item.name.slice(0, 120) } });
    case "add_to_cart":
      return plausibleSend(domain, "Add to Cart", { props: { item: e.item.name.slice(0, 120) } });
    case "begin_checkout":
      return plausibleSend(domain, "Begin Checkout", { props: { items: e.items.length } });
    case "purchase":
      return plausibleSend(domain, "Purchase", { revenue: { currency: e.currency, amount: e.value }, props: { items: e.items.length } });
    case "booking_request":
      return plausibleSend(domain, "Booking Request", { props: { service: (e.name ?? "").slice(0, 120) } });
  }
}

/**
 * Fire-once guard for conversions (purchase / booking), so refreshing or
 * re-opening a confirmation page doesn't double-count revenue. Backed by
 * localStorage; if storage is blocked it falls back to "fire" -- slightly
 * risky for duplicates, but a missed conversion is worse for an ad account.
 */
export function firstTimeFor(key: string): boolean {
  const k = `bn_tracked:${key}`;
  try {
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, "1");
  } catch {
    /* ignore */
  }
  return true;
}
