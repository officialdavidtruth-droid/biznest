import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CartLink } from "@/components/storefront/cart-link";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { PropertyCatalog, type PropertyListing } from "@/components/storefront/property-catalog";
import { resolveStoreTheme, type Section, type TemplateTheme } from "@/lib/template-themes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return {};
  return { title: store.seoTitle ?? store.name, description: store.seoDescription ?? undefined };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 24, include: { category: true } },
      services: { where: { isPublished: true }, take: 24, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 6 },
    },
  });

  if (!store || store.status !== "ACTIVE") notFound();

  const theme = resolveStoreTheme(
    store.template?.category,
    store.name,
    store.themeColors as { primary?: string; secondary?: string; accent?: string } | null,
    store.fontFamily
  );
  // A template's own config (from Settings/seed) can refine catalogLabel/sections
  // beyond the code-side default without needing a redeploy.
  const config = (store.template?.config as { sections?: Section[]; catalogLabel?: string } | null) ?? null;
  const sections: Section[] = config?.sections ?? theme.sections;
  const catalogLabel = config?.catalogLabel ?? theme.catalogLabel;

  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const hasProducts = store.products.length > 0;
  const hasServices = store.services.length > 0;
  const hasCatalog = hasProducts || hasServices;
  const goodReviews = store.reviews.filter((r) => r.rating >= 4 && r.comment);

  const sectionEnabled: Record<Section, boolean> = {
    hero: true,
    catalog: hasCatalog,
    about: Boolean(store.business.description),
    testimonials: goodReviews.length > 0,
    contact: Boolean(store.contactEmail || store.contactPhone || social.whatsapp),
  };

  return (
    <div style={{ background: theme.bg, color: theme.ink, minHeight: "100vh", fontFamily: theme.font }}>
      <SiteHeader store={store} theme={theme} slug={slug} hasProducts={hasProducts} hasServices={hasServices} sectionEnabled={sectionEnabled} />

      {sections.map((s) => {
        if (!sectionEnabled[s]) return null;
        switch (s) {
          case "hero":
            return <Hero key={s} store={store} theme={theme} hasCatalog={hasCatalog} catalogLabel={catalogLabel} />;
          case "catalog":
            return <Catalog key={s} store={store} theme={theme} slug={slug} label={catalogLabel} niche={store.template?.category} />;
          case "about":
            return <About key={s} store={store} theme={theme} />;
          case "testimonials":
            return <Testimonials key={s} reviews={goodReviews} theme={theme} />;
          case "contact":
            return <Contact key={s} store={store} theme={theme} social={social} />;
          default:
            return null;
        }
      })}

      <footer style={{ borderTop: `1px solid ${theme.ink}1a`, marginTop: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 28px", display: "grid", gap: 28, gridTemplateColumns: "1.3fr 1fr 1fr" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} />
              ) : (
                <div style={{ height: 26, width: 26, borderRadius: 6, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", color: theme.bg, fontWeight: 800, fontSize: 12 }}>
                  {store.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontWeight: 700, fontSize: 14 }}>{store.name}</span>
            </div>
            {store.business.description && (
              <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.75, maxWidth: 320 }}>
                {store.business.description.length > 140 ? store.business.description.slice(0, 140) + "…" : store.business.description}
              </p>
            )}
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>Shop</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {(store.products.length > 0 || store.services.length > 0) && <a href="#catalog" style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>{catalogLabel}</a>}
              {sectionEnabled.about && <a href="#about" style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>About</a>}
              {sectionEnabled.contact && <a href="#contact" style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>Contact</a>}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>Connect</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {social.instagram && <a href={social.instagram} style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>Instagram</a>}
              {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>WhatsApp</a>}
              {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>Email</a>}
              {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ color: theme.ink, opacity: 0.8, textDecoration: "none" }}>Call</a>}
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${theme.ink}1a`, padding: "16px 24px", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", maxWidth: 1100, margin: "0 auto", fontSize: 11.5, opacity: 0.6 }}>
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span>Powered by BizNest · Secured checkout · SSL encrypted</span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections — each one reads only real store/business/order data. A section
// with nothing to show doesn't render (handled by `sectionEnabled` above),
// rather than showing an empty or fabricated block.
// ---------------------------------------------------------------------------

type StoreWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.store.findUnique>>> & {
  business: { description: string; verificationBadge: boolean };
  products: Array<{ id: string; name: string; price: unknown; compareAtPrice: unknown; currency: string; images: string[]; type: string; rentalPeriodUnit: string | null; attributes: unknown; category: { name: string } | null }>;
  services: Array<{ id: string; name: string; description: string; price: unknown; currency: string; isBookable: boolean; category: { name: string } | null }>;
  reviews: Array<{ id: string; rating: number; comment: string | null; author: { name: string | null } }>;
};

function SiteHeader({ store, theme, slug, hasProducts, hasServices, sectionEnabled }: {
  store: StoreWithRelations; theme: TemplateTheme; slug: string; hasProducts: boolean; hasServices: boolean; sectionEnabled: Record<Section, boolean>;
}) {
  return (
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
          <span style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${theme.accent}`, color: theme.accent, borderRadius: 999, padding: "3px 10px" }}>✓ Verified</span>
        )}
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14 }}>
        {(hasProducts || hasServices) && <a href="#catalog" style={{ color: theme.ink, textDecoration: "none", opacity: 0.85 }}>Shop</a>}
        {sectionEnabled.about && <a href="#about" style={{ color: theme.ink, textDecoration: "none", opacity: 0.85 }}>About</a>}
        {sectionEnabled.contact && <a href="#contact" style={{ color: theme.ink, textDecoration: "none", opacity: 0.85 }}>Contact</a>}
        <span style={{ color: theme.ink }}><CartLink storeSlug={slug} /></span>
      </nav>
    </header>
  );
}

function Hero({ store, theme, hasCatalog, catalogLabel }: { store: StoreWithRelations; theme: TemplateTheme; hasCatalog: boolean; catalogLabel: string }) {
  const cta = hasCatalog ? theme.cta : null;

  if (theme.heroStyle === "fullbleed") {
    const bg = store.bannerUrl
      ? `linear-gradient(0deg, ${theme.bg}f2, ${theme.bg}66), url(${store.bannerUrl}) center/cover`
      : `linear-gradient(135deg, ${theme.accent}33, ${theme.bg})`;
    return (
      <section style={{ background: bg, padding: "88px 24px 64px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow theme={theme} />
          <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 700, lineHeight: 1.06, maxWidth: 700, margin: 0 }}>{theme.headline}</h1>
          <p style={{ fontSize: 17, opacity: 0.85, marginTop: 14, maxWidth: 520 }}>{theme.sub}</p>
          {cta && <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>}
        </div>
      </section>
    );
  }

  if (theme.heroStyle === "split") {
    return (
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 44px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 32, alignItems: "center" }}>
        <div>
          <Eyebrow theme={theme} />
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 700, lineHeight: 1.08, margin: 0 }}>{theme.headline}</h1>
          <p style={{ fontSize: 16, opacity: 0.8, marginTop: 14, maxWidth: 460 }}>{theme.sub}</p>
          {cta && <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>}
        </div>
        <div
          style={{
            aspectRatio: "4/3",
            borderRadius: theme.radius,
            overflow: "hidden",
            position: "relative",
            background: store.bannerUrl
              ? undefined
              : `radial-gradient(circle at 25% 20%, ${theme.accent}55, transparent 55%), radial-gradient(circle at 80% 75%, ${theme.accent}33, transparent 50%), ${theme.card}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {store.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.bannerUrl} alt={store.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontFamily: theme.font, fontSize: "min(30vw, 130px)", fontWeight: 800, color: `${theme.accent}33`, lineHeight: 1, userSelect: "none" }}>
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </section>
    );
  }

  // centered (default)
  return (
    <section style={{ padding: "64px 24px 48px", maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
      <Eyebrow theme={theme} />
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 700, lineHeight: 1.08, margin: "0 auto" }}>{theme.headline}</h1>
      <p style={{ fontSize: 16, opacity: 0.8, marginTop: 14, maxWidth: 460, margin: "14px auto 0" }}>{theme.sub}</p>
      {cta && (
        <div style={{ marginTop: 8 }}>
          <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>
        </div>
      )}
    </section>
  );
}

function Eyebrow({ theme }: { theme: TemplateTheme }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.accent, marginBottom: 12 }}>
      {theme.eyebrow}
    </p>
  );
}

function HeroCta({ href, theme, children }: { href: string; theme: TemplateTheme; children: React.ReactNode }) {
  return (
    <a href={href} style={{ display: "inline-block", marginTop: 24, background: theme.accent, color: theme.bg, padding: "12px 28px", borderRadius: theme.radius, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
      {children}
    </a>
  );
}

function Catalog({ store, theme, slug, label, niche }: { store: StoreWithRelations; theme: TemplateTheme; slug: string; label: string; niche?: string }) {
  if (niche === "Real Estate & Property" && store.products.length > 0) {
    const listings: PropertyListing[] = store.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      currency: p.currency,
      image: p.images[0] ?? null,
      attributes: (p.attributes as PropertyListing["attributes"]) ?? {},
    }));
    return (
      <section id="catalog" style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 48px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>{label}</h2>
        <PropertyCatalog listings={listings} theme={theme} />
      </section>
    );
  }

  // Group by category when a store has actually organized its catalog that
  // way (2+ distinct categories present) — this is the real "menu
  // categories" behavior for food stores and anyone else using categories.
  // A store with one or zero categories just gets the flat grid, unchanged.
  const categoryNames = new Set(store.products.map((p) => p.category?.name).filter(Boolean));
  const grouped = categoryNames.size >= 2;
  const productGroups: Array<[string | null, typeof store.products]> = grouped
    ? Array.from(
        store.products.reduce((map, p) => {
          const key = p.category?.name ?? null;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(p);
          return map;
        }, new Map<string | null, typeof store.products>())
      )
    : [[null, store.products]];

  return (
    <section id="catalog" style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 48px" }}>
      {store.products.length > 0 && (
        <>
          {!grouped && (
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>{label}</h2>
          )}
          {productGroups.map(([groupName, items], gi) => (
            <div key={groupName ?? "uncategorized"} style={{ marginBottom: gi === productGroups.length - 1 && store.services.length === 0 ? 0 : 32 }}>
              {grouped && (
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${theme.ink}1a` }}>
                  {groupName ?? "More"}
                </h2>
              )}
              <div style={{ display: "grid", gap: 18, gridTemplateColumns: theme.layout === "grid" ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr" }}>
                {items.map((p) => (
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
                        {p.compareAtPrice != null && (
                          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5, textDecoration: "line-through" }}>{Number(p.compareAtPrice).toLocaleString()}</span>
                        )}
                      </p>
                      {p.type === "PHYSICAL" && (
                        <div style={{ marginTop: 8, maxWidth: theme.layout === "list" ? 160 : undefined }}>
                          <AddToCartButton storeSlug={slug} productId={p.id} name={p.name} price={Number(p.price)} currency={p.currency} image={p.images[0] ?? null} />
                        </div>
                      )}
                      {p.type === "DIGITAL" && <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Digital delivery</span>}
                      {p.type === "RENTAL" && <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>For rent{p.rentalPeriodUnit ? ` · per ${p.rentalPeriodUnit}` : ""}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {store.services.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>
            {store.products.length > 0 ? "Services" : label}
          </h2>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {store.services.map((s) => (
              <div key={s.id} style={{ background: theme.card, borderRadius: theme.radius, padding: 18 }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</p>
                <p style={{ fontSize: 13, opacity: 0.75, marginTop: 6, lineHeight: 1.5 }}>{s.description.length > 100 ? s.description.slice(0, 100) + "…" : s.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                  <span style={{ fontWeight: 700 }}>{s.currency} {Number(s.price).toLocaleString()}</span>
                  {s.isBookable && <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, border: `1px solid ${theme.accent}`, borderRadius: 999, padding: "4px 10px" }}>Bookable</span>}
                </div>
                {s.isBookable && (
                  <BookingWidget storeSlug={slug} serviceId={s.id} serviceName={s.name} accent={theme.accent} ink={theme.ink} bg={theme.bg} radius={theme.radius} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function About({ store, theme }: { store: StoreWithRelations; theme: TemplateTheme }) {
  return (
    <section id="about" style={{ maxWidth: 780, margin: "0 auto", padding: "12px 24px 56px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 14 }}>About</h2>
      <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.9 }}>{store.business.description}</p>
    </section>
  );
}

function Testimonials({ reviews, theme }: { reviews: StoreWithRelations["reviews"]; theme: TemplateTheme }) {
  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 56px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>What people say</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {reviews.slice(0, 3).map((r) => (
          <div key={r.id} style={{ background: theme.card, borderRadius: theme.radius, padding: 18 }}>
            <div style={{ color: theme.accent, fontSize: 13, marginBottom: 8 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>"{r.comment}"</p>
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>— {r.author.name ?? "Verified buyer"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact({ store, theme, social }: { store: StoreWithRelations; theme: TemplateTheme; social: Record<string, string> }) {
  return (
    <section id="contact" style={{ maxWidth: 780, margin: "0 auto", padding: "12px 24px 64px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 14 }}>Get in touch</h2>
      <div style={{ background: theme.card, borderRadius: theme.radius, padding: 22, display: "flex", flexWrap: "wrap", gap: 12 }}>
        {social.whatsapp && (
          <a href={`https://wa.me/${social.whatsapp}`} style={{ background: theme.accent, color: theme.bg, padding: "11px 22px", borderRadius: theme.radius, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Message on WhatsApp
          </a>
        )}
        {store.contactPhone && (
          <a href={`tel:${store.contactPhone}`} style={{ border: `1px solid ${theme.ink}33`, color: theme.ink, padding: "11px 22px", borderRadius: theme.radius, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Call {store.contactPhone}
          </a>
        )}
        {store.contactEmail && (
          <a href={`mailto:${store.contactEmail}`} style={{ border: `1px solid ${theme.ink}33`, color: theme.ink, padding: "11px 22px", borderRadius: theme.radius, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Email {store.contactEmail}
          </a>
        )}
      </div>
    </section>
  );
}
