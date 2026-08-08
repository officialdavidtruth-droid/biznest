import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { NOVA } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

// All images (logo, banner, product/service photos) come from the store
// owner's own uploads — nothing here is hardcoded artwork. This template is
// structurally different from Fresh & Co. and Heenzy on purpose: a sticky
// side rail instead of a top nav, a split-screen hero instead of full-bleed,
// numbered full-width catalog rows instead of a card grid, and a serif
// display face — so picking it visibly changes the shape of the page, not
// just its color.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "0 60px" };
const serif: React.CSSProperties = { fontFamily: NOVA.headlineFont };
const label: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: NOVA.gold };

export function NovaStorefront({
  store, slug, catalogItems, goodReviews, avgRating, completedOrders, social,
}: {
  store: {
    name: string; logoUrl: string | null; bannerUrl: string | null;
    contactEmail: string | null; contactPhone: string | null;
    business: { description: string | null };
  };
  slug: string;
  catalogItems: CatalogItem[];
  goodReviews: Review[];
  avgRating: number | null;
  completedOrders: number;
  social: Record<string, string>;
}) {
  const heroImage = store.bannerUrl;

  return (
    <div style={{ background: NOVA.black, color: NOVA.cream, fontFamily: NOVA.font, minHeight: "100vh" }}>
      {/* ---------- SIDE RAIL NAV (sticky, not a top bar) ---------- */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 60px", borderBottom: `1px solid ${NOVA.line}`, background: "rgba(10,10,12,.88)", backdropFilter: "blur(10px)" }}>
        <a href={`/store/${slug}`} style={{ ...serif, fontSize: 22, fontWeight: 700, color: NOVA.cream, textDecoration: "none", letterSpacing: "0.02em" }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: 30, borderRadius: "50%", objectFit: "cover", marginRight: 10, verticalAlign: "middle" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {catalogItems.length > 0 && <a href="#collection" style={{ ...label, textDecoration: "none" }}>The Collection</a>}
          <CartLink storeSlug={slug} accent={NOVA.gold} ink={NOVA.cream} />
        </div>
      </div>

      {/* ---------- SPLIT HERO ---------- */}
      <header style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", minHeight: "82vh" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 60px" }}>
          <div style={label}>Est. — Crafted with Intention</div>
          <h1 style={{ ...serif, fontSize: "clamp(40px,5.6vw,72px)", lineHeight: 1.04, margin: "22px 0 0", fontWeight: 700 }}>
            {store.name}
          </h1>
          <p style={{ marginTop: 24, maxWidth: 460, fontSize: 16, lineHeight: 1.75, color: NOVA.gray }}>
            {store.business.description || "A studio built on precision, patience, and a refusal to cut corners."}
          </p>
          {catalogItems.length > 0 && (
            <a href="#collection" style={{ marginTop: 36, display: "inline-flex", alignItems: "center", gap: 12, width: "fit-content", padding: "16px 0", borderTop: `1px solid ${NOVA.line}`, borderBottom: `1px solid ${NOVA.line}`, color: NOVA.cream, textDecoration: "none", fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Explore the Collection <span style={{ color: NOVA.gold }}>→</span>
            </a>
          )}
        </div>
        <div style={{ position: "relative", background: heroImage ? `url(${heroImage}) center/cover` : `linear-gradient(155deg, ${NOVA.charcoal}, ${NOVA.black})`, borderLeft: `1px solid ${NOVA.line}` }}>
          {avgRating != null && (
            <div style={{ position: "absolute", left: 0, bottom: 40, background: NOVA.gold, color: NOVA.black, padding: "16px 26px" }}>
              <b style={{ ...serif, fontSize: 22, display: "block" }}>{avgRating.toFixed(1)} / 5</b>
              <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{goodReviews.length}+ reviews</span>
            </div>
          )}
        </div>
      </header>

      {/* ---------- ABOUT — full-width, centered, serif pull statement ---------- */}
      {store.business.description && (
        <section style={{ padding: "120px 0", borderTop: `1px solid ${NOVA.line}` }}>
          <div style={{ ...wrap, maxWidth: 900, textAlign: "center" }}>
            <div style={label}>What we believe</div>
            <p style={{ ...serif, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.4, marginTop: 22, color: NOVA.cream }}>
              &ldquo;{store.business.description}&rdquo;
            </p>
          </div>
        </section>
      )}

      {/* ---------- COLLECTION — numbered full-width rows, not a card grid ---------- */}
      {catalogItems.length > 0 && (
        <section id="collection" style={{ padding: "0 0 120px", borderTop: `1px solid ${NOVA.line}` }}>
          <div style={wrap}>
            <div style={{ padding: "60px 0 40px" }}>
              <div style={label}>The Collection</div>
              <h2 style={{ ...serif, fontSize: "clamp(30px,3.6vw,44px)", marginTop: 14 }}>Every piece, chosen with care.</h2>
            </div>
            {catalogItems.map((item, i) => (
              <a
                key={`${item.kind}-${item.id}`}
                href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`}
                style={{ display: "grid", gridTemplateColumns: "80px 140px 1fr auto", alignItems: "center", gap: 30, padding: "30px 0", borderTop: `1px solid ${NOVA.line}`, textDecoration: "none", color: "inherit" }}
              >
                <span style={{ ...serif, fontSize: 15, color: NOVA.gray }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ width: 140, height: 96, background: item.image ? `url(${item.image}) center/cover` : NOVA.charcoal, border: `1px solid ${NOVA.line}` }} />
                <div>
                  <h4 style={{ ...serif, fontSize: 20, fontWeight: 700 }}>{item.name}</h4>
                  {item.categoryName && <span style={{ ...label, marginTop: 6, display: "inline-block" }}>{item.categoryName}</span>}
                </div>
                <span style={{ ...serif, fontSize: 18, color: NOVA.gold, whiteSpace: "nowrap" }}>{item.currency} {item.price.toLocaleString()}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIAL — single large quote, not a card ---------- */}
      {goodReviews.length > 0 && goodReviews[0].comment && (
        <section style={{ padding: "110px 0", borderTop: `1px solid ${NOVA.line}`, background: NOVA.charcoal }}>
          <div style={{ ...wrap, maxWidth: 820, textAlign: "center" }}>
            <div style={{ color: NOVA.gold, fontSize: 20, letterSpacing: 4, marginBottom: 22 }}>{"★".repeat(goodReviews[0].rating)}</div>
            <p style={{ ...serif, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.5 }}>&ldquo;{goodReviews[0].comment}&rdquo;</p>
            <p style={{ marginTop: 26, ...label }}>{goodReviews[0].author.name ?? "Verified client"}</p>
          </div>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0) && (
        <section style={{ padding: "70px 0", borderTop: `1px solid ${NOVA.line}` }}>
          <div style={{ ...wrap, display: "flex", gap: 70, flexWrap: "wrap" }}>
            {catalogItems.length > 0 && (
              <div><b style={{ ...serif, fontSize: 34, display: "block", color: NOVA.gold }}>{catalogItems.length}+</b><span style={label}>Pieces in the collection</span></div>
            )}
            {completedOrders > 0 && (
              <div><b style={{ ...serif, fontSize: 34, display: "block", color: NOVA.gold }}>{completedOrders}+</b><span style={label}>Orders fulfilled</span></div>
            )}
          </div>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <NovaNewsletter slug={slug} storeName={store.name} />

      {/* ---------- CONTACT / FOOTER ---------- */}
      <footer style={{ padding: "70px 0 50px", borderTop: `1px solid ${NOVA.line}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 30 }}>
          <div>
            <div style={{ ...serif, fontSize: 20, fontWeight: 700 }}>{store.name}</div>
            <p style={{ marginTop: 10, fontSize: 13, color: NOVA.gray, maxWidth: 320 }}>{store.business.description}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ color: NOVA.cream, textDecoration: "none" }}>WhatsApp</a>}
            {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ color: NOVA.cream, textDecoration: "none" }}>{store.contactPhone}</a>}
            {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ color: NOVA.cream, textDecoration: "none" }}>{store.contactEmail}</a>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function NovaNewsletter({ slug, storeName }: { slug: string; storeName: string }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  return (
    <section style={{ padding: "80px 0", borderTop: `1px solid ${NOVA.line}`, textAlign: "center" }}>
      <div style={wrap}>
        <div style={label}>Stay in the loop</div>
        <h2 style={{ ...serif, fontSize: "clamp(24px,3vw,32px)", marginTop: 14 }}>Join the {storeName} circle</h2>
        <form action={subscribe} style={{ display: "flex", justifyContent: "center", marginTop: 30, gap: 0, maxWidth: 460, margin: "30px auto 0" }}>
          <input name="email" type="email" required placeholder="Your email address" style={{ flex: 1, background: "transparent", border: `1px solid ${NOVA.line}`, borderRight: "none", padding: "16px 18px", color: NOVA.cream, fontSize: 14, outline: "none" }} />
          <button type="submit" style={{ background: NOVA.gold, color: NOVA.black, border: "none", padding: "16px 26px", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Join</button>
        </form>
      </div>
    </section>
  );
}
