import { biznestPromoUrl, BIZNEST_PROMO_CTA, BIZNEST_PROMO_TEXT } from "@/lib/branding";

/** Small credit on stores that have not started paying. Removed automatically once the owner subscribes. */
export function PoweredByBizNest({ slug }: { slug?: string }) {
  return (
    <a
      href={biznestPromoUrl(slug, "storefront")}
      target="_blank"
      rel="noopener"
      aria-label={`${BIZNEST_PROMO_TEXT}. ${BIZNEST_PROMO_CTA}`}
      style={{ position: "fixed", left: 12, bottom: 12, zIndex: 40, maxWidth: "calc(100vw - 24px)", padding: "7px 12px", borderRadius: 999, background: "rgba(17,17,17,0.86)", color: "#fff", fontSize: 11, lineHeight: 1.3, fontFamily: "system-ui, sans-serif", textDecoration: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
    >
      {BIZNEST_PROMO_TEXT} · <span style={{ color: "#F5B82E", fontWeight: 600 }}>{BIZNEST_PROMO_CTA}</span>
    </a>
  );
}
