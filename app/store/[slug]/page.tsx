import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CartLink } from "@/components/storefront/cart-link";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { PropertyCatalog, type PropertyListing } from "@/components/storefront/property-catalog";
import { resolveStoreTheme, type Section, type TemplateTheme } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

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

  // Each StoreTemplate row is now a fully self-contained theme snapshot
  // (one of many variations per niche — see lib/template-themes.ts), not a
  // shared per-category lookup. Read it directly; only fall back to the
  // niche-hash default if a store somehow has no template config at all.
  const templateConfig = store.template?.config as Partial<TemplateTheme> | null;
  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const baseTheme: TemplateTheme = templateConfig?.bg
    ? (templateConfig as TemplateTheme)
    : resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily);
  const theme: TemplateTheme = {
    ...baseTheme,
    bg: themeOverrides?.secondary || baseTheme.bg,
    accent: themeOverrides?.primary || themeOverrides?.accent || baseTheme.accent,
    font: store.fontFamily || baseTheme.font,
  };
  // Vendor-controlled arrangement (Website Builder → Sections) layered on
  // top of the template's default order/visibility. Hero can't be hidden
  // by the vendor; a section can still be absent even if not hidden here
  // when it has no real data behind it (sectionEnabled below handles that).
  const sectionOverrides = store.sectionOverrides as { order?: Section[]; hidden?: Section[] } | null;
  const sections: Section[] = sectionOverrides?.order?.length
    ? sectionOverrides.order.filter((s) => s === "hero" || !sectionOverrides.hidden?.includes(s))
    : theme.sections;
  const catalogLabel = theme.catalogLabel;

  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const hasProducts = store.products.length > 0;
  const hasServices = store.services.length > 0;
  const hasCatalog = hasProducts || hasServices;
  const goodReviews = store.reviews.filter((r) => r.rating >= 4 && r.comment);
  const hasBookableServices = store.services.some((s) => s.isBookable);

  const [completedOrders, deliveryZoneCount] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id, status: { in: ["DELIVERED", "COMPLETED"] } } }),
    prisma.deliveryZone.count({ where: { storeId: store.id, isActive: true } }),
  ]);
  const avgRating = store.reviews.length
    ? store.reviews.reduce((sum, r) => sum + r.rating, 0) / store.reviews.length
    : null;
  const distinctCategories = new Set([
    ...store.products.map((p) => p.category?.name).filter(Boolean),
    ...store.services.map((s) => s.category?.name).filter(Boolean),
  ]);
  const discountedProduct = store.products.find(
    (p) => p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price)
  );

  const sectionEnabled: Record<Section, boolean> = {
    hero: true,
    catalog: hasCatalog,
    about: Boolean(store.business.description),
    stats: hasCatalog || store.reviews.length > 0,
    features: true,
    categories: distinctCategories.size >= 2,
    deal: Boolean(discountedProduct),
    testimonials: goodReviews.length > 0,
    newsletter: true,
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
          case "stats":
            return (
              <Stats
                key={s}
                theme={theme}
                listingCount={store.products.length + store.services.length}
                reviewCount={store.reviews.length}
                avgRating={avgRating}
                completedOrders={completedOrders}
              />
            );
          case "features":
            return (
              <Features
                key={s}
                theme={theme}
                verified={store.business.verificationBadge}
                hasDelivery={deliveryZoneCount > 0}
                hasBooking={hasBookableServices}
              />
            );
          case "categories":
            return <CategoryStrip key={s} store={store} theme={theme} slug={slug} />;
          case "deal":
            return discountedProduct ? (
              <DealBanner key={s} store={store} theme={theme} slug={slug} product={discountedProduct} />
            ) : null;
          case "testimonials":
            return <Testimonials key={s} reviews={goodReviews} theme={theme} />;
          case "newsletter":
            return <Newsletter key={s} slug={slug} theme={theme} />;
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
  template: { previewUrl: string | null } | null;
  products: Array<{ id: string; name: string; price: unknown; compareAtPrice: unknown; currency: string; images: string[]; type: string; rentalPeriodUnit: string | null; attributes: unknown; category: { name: string } | null }>;
  services: Array<{ id: string; name: string; description: string; price: unknown; currency: string; images: string[]; isBookable: boolean; category: { name: string } | null }>;
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
  // A vendor's own upload always wins; falls back to the template's demo
  // photo (lib/demo-images.ts, seeded per niche) so a store looks populated
  // immediately even before the vendor uploads anything of their own. This
  // was the actual bug — previewUrl was wired into the gallery but never
  // into the live storefront, which is why it showed in one place and not
  // the other.
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;

  if (theme.heroStyle === "fullbleed") {
    const bg = heroImage
      ? `linear-gradient(0deg, ${theme.bg}f2, ${theme.bg}66), url(${heroImage}) center/cover`
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
            background: heroImage
              ? undefined
              : `radial-gradient(circle at 25% 20%, ${theme.accent}55, transparent 55%), radial-gradient(circle at 80% 75%, ${theme.accent}33, transparent 50%), ${theme.card}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt={store.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              <div key={s.id} style={{ background: theme.card, borderRadius: theme.radius, overflow: "hidden" }}>
                {s.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.images[0]} alt={s.name} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
                )}
                <div style={{ padding: 18 }}>
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

function CategoryStrip({ store, theme, slug }: { store: StoreWithRelations; theme: TemplateTheme; slug: string }) {
  const counts = new Map<string, number>();
  for (const p of store.products) {
    const name = p.category?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const s of store.services) {
    const name = s.category?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const categories = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (categories.length === 0) return null;

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 24px 40px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>
        Shop by category
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
        {categories.map(([name, count]) => (
          <a
            key={name}
            href="#catalog"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: "18px 12px", borderRadius: theme.radius, background: theme.card,
              border: `1px solid ${theme.ink}14`, textDecoration: "none", color: theme.ink,
              textAlign: "center",
            }}
          >
            <span
              style={{
                width: 40, height: 40, borderRadius: "50%", background: `${theme.accent}22`,
                color: theme.accent, display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</span>
            <span style={{ fontSize: 11, opacity: 0.55 }}>{count} item{count !== 1 ? "s" : ""}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function DealBanner({ store, theme, slug, product }: {
  store: StoreWithRelations; theme: TemplateTheme; slug: string;
  product: StoreWithRelations["products"][number];
}) {
  const price = Number(product.price);
  const compareAt = Number(product.compareAtPrice);
  const pctOff = Math.round((1 - price / compareAt) * 100);

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 24px 40px" }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
          gap: 20, padding: "28px 32px", borderRadius: theme.radius,
          background: `linear-gradient(120deg, ${theme.accent}, ${theme.accent}bb)`, color: theme.bg,
        }}
      >
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, marginBottom: 6 }}>
            Deal of the day · {pctOff}% off
          </p>
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{product.name}</h3>
          <p style={{ marginTop: 8, fontSize: 15 }}>
            <span style={{ fontWeight: 700 }}>{product.currency} {price.toLocaleString()}</span>{" "}
            <span style={{ opacity: 0.7, textDecoration: "line-through" }}>{product.currency} {compareAt.toLocaleString()}</span>
          </p>
        </div>
        <a
          href="#catalog"
          style={{
            background: theme.bg, color: theme.accent, padding: "12px 24px", borderRadius: theme.radius,
            fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap",
          }}
        >
          Shop the deal →
        </a>
      </div>
    </section>
  );
}

function Stats({ theme, listingCount, reviewCount, avgRating, completedOrders }: {
  theme: TemplateTheme; listingCount: number; reviewCount: number; avgRating: number | null; completedOrders: number;
}) {
  const items = [
    { value: `${listingCount}+`, label: "Listings" },
    ...(avgRating ? [{ value: `${avgRating.toFixed(1)}★`, label: `${reviewCount} review${reviewCount === 1 ? "" : "s"}` }] : []),
    ...(completedOrders > 0 ? [{ value: `${completedOrders}+`, label: "Orders completed" }] : []),
  ];
  if (items.length < 2) return null; // one lonely number isn't a "stats bar"

  return (
    <section style={{ background: theme.card, padding: "28px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "space-around" }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: theme.accent }}>{it.value}</p>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features({ theme, verified, hasDelivery, hasBooking }: {
  theme: TemplateTheme; verified: boolean; hasDelivery: boolean; hasBooking: boolean;
}) {
  const items = [
    verified && { icon: "🪪", title: "Verified seller", body: "ID and business checks completed before this store went live." },
    { icon: "🔒", title: "Secure payments", body: "Every checkout runs through Paystack — your card details never touch this store directly." },
    hasDelivery && { icon: "🚚", title: "Local delivery", body: "Delivery pricing shown at checkout for supported areas." },
    hasBooking && { icon: "📅", title: "Instant booking", body: "Pick a real open slot and confirm — no back-and-forth." },
  ].filter(Boolean) as Array<{ icon: string; title: string; body: string }>;

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 48px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 18 }}>Why shop here</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {items.map((it) => (
          <div key={it.title} style={{ background: theme.card, borderRadius: theme.radius, padding: 18 }}>
            <span style={{ fontSize: 20 }}>{it.icon}</span>
            <p style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{it.title}</p>
            <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Newsletter({ slug, theme }: { slug: string; theme: TemplateTheme }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  return (
    <section style={{ background: theme.card, padding: "32px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontWeight: 700, fontSize: 16 }}>Get notified about new drops</p>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>No spam — just this store's updates.</p>
        <form action={subscribe} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <input
            name="email" type="email" required placeholder="you@email.com"
            style={{ flex: "1 1 220px", padding: "10px 14px", borderRadius: theme.radius, border: `1px solid ${theme.ink}33`, background: "transparent", color: theme.ink, fontSize: 13 }}
          />
          <button style={{ background: theme.accent, color: theme.bg, border: 0, padding: "10px 22px", borderRadius: theme.radius, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Subscribe
          </button>
        </form>
      </div>
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
