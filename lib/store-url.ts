const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

type StoreForUrl = {
  slug: string;
  customDomain: string | null;
  customDomainStatus: string;
};

/**
 * Builds the customer-facing URL for a store, using its verified custom
 * domain when it has one, and falling back to the platform's
 * biznest.space/<slug> path otherwise.
 *
 * This matters most for payment gateway callbacks: the gateway redirects
 * the browser back to a fixed URL we gave it at checkout time, with no
 * way for us to know afterward which host the customer actually started
 * on. If we always redirect to APP_URL, a customer who checked out on a
 * store's own custom domain (and whose session cookie is scoped to that
 * domain) lands on a different host with no valid session — the order
 * confirmation page still renders (it doesn't require auth), but the
 * moment they click through to something that does require auth, it
 * looks exactly like being logged out, and their order appears missing.
 */
export function buildStoreUrl(store: StoreForUrl, path: string): string {
  const base =
    store.customDomain && store.customDomainStatus === "VERIFIED"
      ? `https://${store.customDomain}`
      : `${APP_URL}/${store.slug}`;
  return `${base}${path}`;
}
