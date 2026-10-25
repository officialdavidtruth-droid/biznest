import { beforeEach, describe, expect, it, vi } from "vitest";

// Browser-side tracking core, run against stubbed browser globals. The
// important guarantees: events go to the right provider with the right shape,
// and an event for one store can never be reported into another store's
// analytics when a shopper soft-navigates between stores in the SPA.

type Fetched = { url: string; body: Record<string, any> };
let fetched: Fetched[];
let scripts: string[];
let storage: Map<string, string>;
let loc: { hostname: string; pathname: string; search: string; href: string };

async function load() {
  vi.resetModules();
  const g = globalThis as any;
  g.window = g;
  g.dataLayer = undefined;
  g.gtag = undefined;
  g.fbq = undefined;
  g._fbq = undefined;
  g.__bnTracking = undefined;
  storage = new Map();
  scripts = [];
  fetched = [];
  loc = { hostname: "mystore.com", pathname: "/a/product/1", search: "", href: "https://mystore.com/a/product/1" };
  g.location = loc;
  g.localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) };
  g.document = {
    referrer: "https://google.com/",
    head: { appendChild: (s: { src: string }) => scripts.push(s.src) },
    querySelector: () => null,
    createElement: () => ({ dataset: {} }),
  };
  g.fetch = (url: string, init: { body: string }) => {
    fetched.push({ url, body: JSON.parse(init.body) });
    return Promise.resolve({});
  };
  return import("@/lib/tracking/client");
}

const gtag = () => ((globalThis as any).dataLayer as unknown[]).map((a) => Array.from(a as ArrayLike<unknown>)) as any[][];
const fbq = () => (((globalThis as any).fbq.queue as unknown[]).map((a) => Array.from(a as ArrayLike<unknown>))) as any[][];
const ITEM = { id: "p1", name: "Shoe", price: 5000, quantity: 2, variant: "42" };

describe("tracking client", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeEach(async () => {
    m = await load();
  });

  it("loads GA + Meta, turns Meta's auto form-scraping off before init", () => {
    m.registerTracking({ slug: "a", gaId: "G-AAAAAA1111", metaPixelId: "111111111111111", plausibleDomain: null });
    expect(scripts).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-AAAAAA1111", "https://connect.facebook.net/en_US/fbevents.js"]);
    expect(gtag().some((c) => c[0] === "config" && c[1] === "G-AAAAAA1111" && c[2].send_page_view === false)).toBe(true);
    expect(fbq().slice(0, 2)).toEqual([["set", "autoConfig", false, "111111111111111"], ["init", "111111111111111"]]);
  });

  it("sends page views once per URL to every configured provider", () => {
    m.registerTracking({ slug: "a", gaId: "G-AAAAAA1111", metaPixelId: "111111111111111", plausibleDomain: "a.com" });
    m.trackPageView("a", true);
    m.trackPageView("a", false); // same URL: de-duplicated
    expect(gtag().filter((c) => c[1] === "page_view")).toHaveLength(1);
    expect(fbq().filter((c) => c[2] === "PageView")).toHaveLength(1);
    expect(fetched).toHaveLength(1);
    expect(fetched[0].url).toBe("https://plausible.io/api/event");
    expect(fetched[0].body).toMatchObject({ domain: "a.com", name: "pageview", referrer: "https://google.com/" });
  });

  it("maps add_to_cart and purchase to each provider's event shape", () => {
    m.registerTracking({ slug: "a", gaId: "G-AAAAAA1111", metaPixelId: "111111111111111", plausibleDomain: "a.com" });
    m.trackEvent("a", { type: "add_to_cart", currency: "NGN", item: ITEM });
    const add = gtag().filter((c) => c[1] === "add_to_cart")[0];
    expect(add[2]).toMatchObject({ send_to: "G-AAAAAA1111", value: 10000, currency: "NGN" });
    expect(fbq().filter((c) => c[2] === "AddToCart")[0][3]).toMatchObject({ value: 10000, currency: "NGN" });

    m.trackEvent("a", { type: "purchase", currency: "NGN", value: 12500, transactionId: "ord_1", items: [ITEM] });
    expect(gtag().filter((c) => c[1] === "purchase")[0][2]).toMatchObject({ transaction_id: "ord_1", value: 12500 });
    const p = fbq().filter((c) => c[2] === "Purchase")[0];
    expect(p[4]).toEqual({ eventID: "ord_1" });
    expect(fetched.filter((f) => f.body.name === "Purchase")[0].body.revenue).toEqual({ currency: "NGN", amount: 12500 });
  });

  it("never reports store A's events into another store's analytics", () => {
    const offA = m.registerTracking({ slug: "a", gaId: "G-AAAAAA1111", metaPixelId: "111111111111111", plausibleDomain: "a.com" });
    const offB = m.registerTracking({ slug: "b", gaId: null, metaPixelId: null, plausibleDomain: "b.com" });
    fetched.length = 0;
    const [g0, f0] = [gtag().length, fbq().length];

    m.trackEvent("a", { type: "add_to_cart", currency: "NGN", item: ITEM }); // stale: B is active
    expect(fetched).toHaveLength(0);
    m.trackEvent("b", { type: "add_to_cart", currency: "NGN", item: ITEM });
    expect(fetched.map((f) => f.body.domain)).toEqual(["b.com"]);
    expect(gtag()).toHaveLength(g0);
    expect(fbq()).toHaveLength(f0);

    offA(); // A's late cleanup must not wipe B's registration
    expect((globalThis as any).__bnTracking.slug).toBe("b");
    offB();
    expect((globalThis as any).__bnTracking).toBeUndefined();
  });

  it("never fires on admin, account or wallet-pay URLs", () => {
    m.registerTracking({ slug: "a", gaId: null, metaPixelId: null, plausibleDomain: "a.com" });
    for (const p of ["/store/a/admin/orders", "/a/account/orders", "/store/a/wallet-pay/secret"]) {
      loc.pathname = p;
      loc.href = `https://mystore.com${p}`;
      m.trackEvent("a", { type: "view_item", currency: "NGN", item: ITEM });
      m.trackPageView("a", false);
    }
    expect(fetched).toHaveLength(0);
  });

  it("respects Plausible's localhost and opt-out conventions", () => {
    m.registerTracking({ slug: "a", gaId: null, metaPixelId: null, plausibleDomain: "a.com" });
    loc.hostname = "localhost";
    m.trackEvent("a", { type: "view_item", currency: "NGN", item: ITEM });
    loc.hostname = "mystore.com";
    storage.set("plausible_ignore", "true");
    m.trackEvent("a", { type: "view_item", currency: "NGN", item: ITEM });
    expect(fetched).toHaveLength(0);
  });

  it("counts a conversion only once per id", () => {
    expect(m.firstTimeFor("purchase:a:ord_1")).toBe(true);
    expect(m.firstTimeFor("purchase:a:ord_1")).toBe(false);
    expect(m.firstTimeFor("purchase:a:ord_2")).toBe(true);
  });

  it("swallows provider failures so the storefront never breaks", () => {
    m.registerTracking({ slug: "a", gaId: null, metaPixelId: null, plausibleDomain: "a.com" });
    (globalThis as any).fetch = () => {
      throw new Error("blocked by an ad blocker");
    };
    expect(() => m.trackEvent("a", { type: "booking_request", currency: "NGN", value: 0, transactionId: "b1" })).not.toThrow();
  });
});
