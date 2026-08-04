import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CartLink } from "@/components/storefront/cart-link";
import { resolveStoreTheme } from "@/lib/template-themes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return {};
  return {
    title: store.seoTitle ?? store.name,
    description: store.seoDescription ?? undefined,
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 24 },
      services: { where: { isPublished: true }, take: 24 },
    },
  });

  if (!store || store.status !== "ACTIVE") notFound();

  const theme = resolveStoreTheme(
    store.template?.category,
    store.name,
    store.themeColors as { primary?: string; secondary?: string; accent?: string } | null,
    store.fontFamily
  );
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const hasProducts = store.products.length > 0;
  const hasServices = store.services.length > 0;

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: "100vh", fontFamily: theme.font }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${theme.ink}1a`, position: "sticky", top: 0, backdropFilter: "blur(8px)", background: `${theme.bg}e6`, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div style={{ height: 32, width: 32, borderRadius: 8, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", color: theme.bg, fontWeight: 800, fontSize: 14 }}>
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontWeight: 700, fontSize: 17 }}>{store.name}</span>
          {store.business.verificationBadge && (
            <span style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${theme.accent}`, color: theme.accent, borderRadius: 999, padding: "3px 10px" }}>
              ✓ Verified
            </span>
          )}
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14 }}>
          {hasProducts && <a href="#products" style={{ color: theme.ink, textDecoration: "none", opacity: 0.85 }}>Products</a>}
          {hasServices && <a href="#services" style={{ color: theme.ink, textDecoration: "none", opacity: 0.85 }}>Services</a>}
          <span style={{ color: theme.ink }}>
            <CartLink storeSlug={slug} />
          </span>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ padding: "56px 24px 44px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.accent, marginBottom: 12 }}>
          {theme.eyebrow}
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", fontWeight: 700, lineHeight: 1.08, maxWidth: 680, margin: 0 }}>
          {theme.headline}
        </h1>
        <p style={{ fontSize: 17, opacity: 0.8, marginTop: 14, maxWidth: 520 }}>{theme.sub}</p>
        {(hasProducts || hasServices) && (
          <a
            href={hasProducts ? "#products" : "#services"}
            style={{ display: "inline-block", marginTop: 24, background: theme.accent, color: theme.bg, padding: "12px 28px", borderRadius: theme.radius, fontWeight: 700, textDecoration: "none", fontSize: 14 }}
          >
            {theme.cta}
          </a>
        )}
      </section>

      {/* Products */}
      {hasProducts && (
        <section id="products" style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 48px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>
            Products
          </h2>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: theme.layout === "grid" ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr" }}>
            {store.products.map((p) => (
              <div key={p.id} style={{ background: theme.card, borderRadius: theme.radius, overflow: "hidden", display: theme.layout === "list" ? "flex" : "block", gap: 16, alignItems: "center" }}>
                <div style={{ aspectRatio: theme.layout === "list" ? undefined : "4/3", width: theme.layout === "list" ? 120 : "100%", height: theme.layout === "list" ? 90 : undefined, flexShrink: 0, background: `${theme.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 22, opacity: 0.4 }}>{store.name.charAt(0)}</span>
                  )}
                </div>
                <div style={{ padding: theme.layout === "list" ? "10px 16px 10px 0" : 14 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                  <p style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                    {p.currency} {Number(p.price).toLocaleString()}
                    {p.compareAtPrice && (
                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5, textDecoration: "line-through" }}>
                        {Number(p.compareAtPrice).toLocaleString()}
                      </span>
                    )}
                  </p>
                  {p.type === "PHYSICAL" && (
                    <div style={{ marginTop: 8, maxWidth: theme.layout === "list" ? 160 : undefined }}>
                      <AddToCartButton
                        storeSlug={slug}
                        productId={p.id}
                        name={p.name}
                        price={Number(p.price)}
                        currency={p.currency}
                        image={p.images[0] ?? null}
                      />
                    </div>
                  )}
                  {p.type === "DIGITAL" && (
                    <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Digital delivery</span>
                  )}
                  {p.type === "RENTAL" && (
                    <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>For rent{p.rentalPeriodUnit ? ` · per ${p.rentalPeriodUnit}` : ""}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {hasServices && (
        <section id="services" style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 60px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>
            Services
          </h2>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {store.services.map((s) => (
              <div key={s.id} style={{ background: theme.card, borderRadius: theme.radius, padding: 18 }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</p>
                <p style={{ fontSize: 13, opacity: 0.75, marginTop: 6, lineHeight: 1.5 }}>
                  {s.description.length > 100 ? s.description.slice(0, 100) + "…" : s.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                  <span style={{ fontWeight: 700 }}>{s.currency} {Number(s.price).toLocaleString()}</span>
                  {s.isBookable && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, border: `1px solid ${theme.accent}`, borderRadius: 999, padding: "4px 10px" }}>
                      Bookable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasProducts && !hasServices && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 60px", opacity: 0.7 }}>
          Nothing listed yet — check back soon.
        </section>
      )}

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${theme.ink}1a`, padding: "28px 24px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
        <span>© {new Date().getFullYear()} {store.name}</span>
        <div style={{ display: "flex", gap: 14 }}>
          {social.instagram && <a href={social.instagram} style={{ color: theme.ink }}>Instagram</a>}
          {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ color: theme.ink }}>WhatsApp</a>}
          {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ color: theme.ink }}>Contact</a>}
        </div>
        <span>Secured by BizNest · SSL encrypted</span>
      </footer>
    </div>
  );
}
