import { biznestPromoUrl, BIZNEST_PROMO_CTA, BIZNEST_PROMO_TEXT } from "@/lib/branding";

/** Small credit in the page footer of stores that have not started paying. It sits at the very bottom of the page, not floating. Removed automatically once the owner subscribes. */
export function PoweredByBizNest({ slug }: { slug?: string }) {
  return (
    <>
    {/* Hidden while the page spinner (data-store-loading) is showing, so the credit only appears once the page has loaded. */}
    <style>{"body:has([data-store-loading]) .bn-powered{display:none}"}</style>
    <footer className="bn-powered" style={{ width: "100%", background: "#111", textAlign: "center", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))" }}>
      <a
        href={biznestPromoUrl(slug, "storefront")}
        target="_blank"
        rel="noopener"
        aria-label={`${BIZNEST_PROMO_TEXT}. ${BIZNEST_PROMO_CTA}`}
        style={{ color: "#fff", fontSize: 12, lineHeight: 1.4, fontFamily: "system-ui, sans-serif", textDecoration: "none" }}
      >
        {BIZNEST_PROMO_TEXT} · <span style={{ color: "#F5B82E", fontWeight: 600 }}>{BIZNEST_PROMO_CTA}</span>
      </a>
    </footer>
    </>
  );
}
