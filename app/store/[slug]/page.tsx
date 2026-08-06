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

      <footer style={{ background: LUMINA_BG_DIM, marginTop: 20 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 24px 28px", display: "grid", gap: 28, gridTemplateColumns: "1.3fr 1fr 1fr" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} />
              ) : (
                <div style={{ height: 26, width: 26, borderRadius: 6, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>
                  {store.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontFamily: theme.headlineFont, fontWeight: 600, fontSize: 15 }}>{store.name}</span>
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
        <div style={{ borderTop: `1px solid ${theme.ink}1a`, padding: "16px 24px", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", maxWidth: 1280, margin: "0 auto", fontSize: 11.5, opacity: 0.6 }}>
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span>Powered by BizNest · Secured checkout · SSL encrypted</span>
        </div>
      </footer>
    </div>
  );
}

// Lumina "surface-container-low" — the light off-white used to separate
// the footer from the page's base surface without a hard border.
const LUMINA_BG_DIM = "#ECF5FE";

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
    <header
      style={{ background: `${theme.bg}e6`, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      className="sticky top-0 z-20 w-full backdrop-blur-xl"
    >
      <div style={{ maxWidth: 1280 }} className="mx-auto flex h-20 items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div style={{ height: 32, width: 32, borderRadius: 8, background: theme.accent, color: "#fff" }} className="flex items-center justify-center font-extrabold text-sm">
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontFamily: theme.headlineFont }} className="text-lg font-semibold">{store.name}</span>
          {store.business.verificationBadge && (
            <span style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${theme.accent}`, color: theme.accent, borderRadius: 999, padding: "3px 10px" }}>✓ Verified</span>
          )}
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex" style={{ color: theme.ink }}>
          {(hasProducts || hasServices) && <a href="#catalog" className="opacity-70 transition-opacity hover:opacity-100 hover:!text-[var(--lumina-accent)]" style={{ ["--lumina-accent" as string]: theme.accent }}>Shop</a>}
          {sectionEnabled.about && <a href="#about" className="opacity-70 transition-opacity hover:opacity-100">About</a>}
          {sectionEnabled.contact && <a href="#contact" className="opacity-70 transition-opacity hover:opacity-100">Contact</a>}
        </nav>
        <div className="flex items-center gap-5">
          <CartLink storeSlug={slug} accent={theme.accent} ink={theme.ink} />
        </div>
      </div>
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
      ? `linear-gradient(90deg, ${theme.bg}cc 0%, ${theme.bg}66 55%, transparent 100%), url(${heroImage}) center/cover`
      : `linear-gradient(135deg, ${theme.accent}22, ${theme.bg})`;
    return (
      <section className="relative flex min-h-[560px] items-center overflow-hidden" style={{ background: bg }}>
        <div style={{ maxWidth: 1280 }} className="relative z-10 mx-auto w-full px-6 py-24">
          <Eyebrow theme={theme} pill />
          <h1 style={{ fontFamily: theme.headlineFont, letterSpacing: "-0.02em" }} className="mt-4 max-w-2xl text-[2.5rem] font-extrabold leading-[1.1] sm:text-[3.5rem]">{theme.headline}</h1>
          <p style={{ opacity: 0.75 }} className="mt-4 max-w-lg text-lg leading-relaxed">{theme.sub}</p>
          {cta && <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>}
        </div>
      </section>
    );
  }

  if (theme.heroStyle === "split") {
    return (
      <section style={{ maxWidth: 1280 }} className="mx-auto grid items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div>
          <Eyebrow theme={theme} />
          <h1 style={{ fontFamily: theme.headlineFont, letterSpacing: "-0.02em" }} className="mt-4 text-[2.25rem] font-extrabold leading-[1.1] sm:text-[3rem]">{theme.headline}</h1>
          <p style={{ opacity: 0.7 }} className="mt-4 max-w-md text-base leading-relaxed">{theme.sub}</p>
          {cta && <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>}
        </div>
        <div
          style={{
            aspectRatio: "4/3",
            borderRadius: theme.radius,
            background: heroImage
              ? undefined
              : `radial-gradient(circle at 25% 20%, ${theme.accent}33, transparent 55%), radial-gradient(circle at 80% 75%, ${theme.accent}22, transparent 50%), ${theme.card}`,
            boxShadow: "0 10px 40px rgba(18,18,18,0.08)",
          }}
          className="relative flex items-center justify-center overflow-hidden"
        >
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt={store.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontFamily: theme.headlineFont, fontSize: "min(28vw, 120px)", fontWeight: 800, color: `${theme.accent}33`, lineHeight: 1, userSelect: "none" }}>
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </section>
    );
  }

  // centered (default)
  return (
    <section style={{ maxWidth: 780 }} className="mx-auto px-6 pb-14 pt-20 text-center">
      <Eyebrow theme={theme} pill center />
      <h1 style={{ fontFamily: theme.headlineFont, letterSpacing: "-0.02em" }} className="mx-auto mt-4 text-[2.25rem] font-extrabold leading-[1.1] sm:text-[3rem]">{theme.headline}</h1>
      <p style={{ opacity: 0.7 }} className="mx-auto mt-4 max-w-md text-base leading-relaxed">{theme.sub}</p>
      {cta && (
        <div className="mt-2 flex justify-center">
          <HeroCta href="#catalog" theme={theme}>{cta}</HeroCta>
        </div>
      )}
    </section>
  );
}

function Eyebrow({ theme, pill = false, center = false }: { theme: TemplateTheme; pill?: boolean; center?: boolean }) {
  if (pill) {
    return (
      <span
        style={{ background: `${theme.card}cc`, color: theme.ink, backdropFilter: "blur(6px)" }}
        className={`inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${center ? "" : ""}`}
      >
        {theme.eyebrow}
      </span>
    );
  }
  return (
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.accent }}>
      {theme.eyebrow}
    </p>
  );
}

function HeroCta({ href, theme, children }: { href: string; theme: TemplateTheme; children: React.ReactNode }) {
  // Hover color-swap via a CSS variable + Tailwind arbitrary value, since
  // this renders inside a Server Component tree and can't carry JS event
  // handlers (onMouseEnter/etc aren't allowed there).
  return (
    <a
      href={href}
      style={{ ["--hero-cta-hover" as string]: theme.accent, background: theme.ink, color: theme.bg, boxShadow: "0 8px 30px rgba(20,29,35,0.12)" }}
      className="mt-6 inline-flex h-12 items-center rounded-full px-8 text-sm font-semibold no-underline transition-all duration-300 hover:-translate-y-0.5 hover:!bg-[var(--hero-cta-hover)] hover:!text-white"
    >
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
      <section id="catalog" style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-16 pt-4">
        <h2 style={{ fontFamily: theme.headlineFont }} className="mb-5 text-2xl font-bold">{label}</h2>
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
    <section id="catalog" style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-16 pt-4">
      {store.products.length > 0 && (
        <>
          {!grouped && (
            <h2 style={{ fontFamily: theme.headlineFont }} className="mb-5 text-2xl font-bold">{label}</h2>
          )}
          {productGroups.map(([groupName, items], gi) => (
            <div key={groupName ?? "uncategorized"} style={{ marginBottom: gi === productGroups.length - 1 && store.services.length === 0 ? 0 : 32 }}>
              {grouped && (
                <h2 style={{ fontFamily: theme.headlineFont }} className="mb-4 border-b pb-2 text-base font-semibold" >
                  {groupName ?? "More"}
                </h2>
              )}
              <div style={{ display: "grid", gap: 24, gridTemplateColumns: theme.layout === "grid" ? "repeat(auto-fill, minmax(220px, 1fr))" : "1fr" }}>
                {items.map((p) => (
                  theme.layout === "list" ? (
                    <div key={p.id} style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="flex items-center gap-4 overflow-hidden">
                      <div style={{ width: 120, height: 90, background: theme.bg }} className="flex flex-shrink-0 items-center justify-center overflow-hidden">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 22, opacity: 0.4 }}>{store.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 py-3 pr-4">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="mt-1 text-sm font-bold">
                          {p.currency} {Number(p.price).toLocaleString()}
                          {p.compareAtPrice != null && (
                            <span className="ml-2 text-xs font-normal opacity-50 line-through">{Number(p.compareAtPrice).toLocaleString()}</span>
                          )}
                        </p>
                        {p.type === "PHYSICAL" && (
                          <div className="mt-2 max-w-[180px]">
                            <AddToCartButton storeSlug={slug} productId={p.id} name={p.name} price={Number(p.price)} currency={p.currency} image={p.images[0] ?? null} accent={theme.accent} onAccent="#fff" />
                          </div>
                        )}
                        {p.type === "DIGITAL" && <span className="mt-2 inline-block text-xs font-semibold opacity-60">Digital delivery</span>}
                        {p.type === "RENTAL" && <span className="mt-2 inline-block text-xs font-semibold opacity-60">For rent{p.rentalPeriodUnit ? ` · per ${p.rentalPeriodUnit}` : ""}</span>}
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="group">
                      <div
                        style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }}
                        className="relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden p-4 transition-shadow group-hover:shadow-lg"
                      >
                        {p.compareAtPrice != null && (
                          <span style={{ background: `${theme.accent}1a`, color: theme.accent }} className="absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-semibold">Sale</span>
                        )}
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <span style={{ fontSize: 30, opacity: 0.3 }}>{store.name.charAt(0)}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p style={{ opacity: 0.65 }} className="mt-1 text-sm">
                        {p.currency} {Number(p.price).toLocaleString()}
                        {p.compareAtPrice != null && (
                          <span className="ml-2 text-xs line-through opacity-70">{Number(p.compareAtPrice).toLocaleString()}</span>
                        )}
                      </p>
                      {p.type === "PHYSICAL" && (
                        <AddToCartButton storeSlug={slug} productId={p.id} name={p.name} price={Number(p.price)} currency={p.currency} image={p.images[0] ?? null} accent={theme.accent} onAccent="#fff" />
                      )}
                      {p.type === "DIGITAL" && <span className="mt-2 inline-block text-xs font-semibold opacity-60">Digital delivery</span>}
                      {p.type === "RENTAL" && <span className="mt-2 inline-block text-xs font-semibold opacity-60">For rent{p.rentalPeriodUnit ? ` · per ${p.rentalPeriodUnit}` : ""}</span>}
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {store.services.length > 0 && (
        <>
          <h2 style={{ fontFamily: theme.headlineFont }} className="mb-4 mt-2 text-xl font-bold">
            {store.products.length > 0 ? "Services" : label}
          </h2>
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {store.services.map((s) => (
              <div key={s.id} style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="overflow-hidden transition-shadow hover:shadow-lg">
                {s.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.images[0]} alt={s.name} className="aspect-video w-full object-cover" />
                )}
                <div className="p-5">
                  <p className="text-base font-semibold">{s.name}</p>
                  <p style={{ opacity: 0.7 }} className="mt-1.5 text-sm leading-relaxed">{s.description.length > 100 ? s.description.slice(0, 100) + "…" : s.description}</p>
                  <div className="mt-3.5 flex items-center justify-between">
                    <span className="font-bold">{s.currency} {Number(s.price).toLocaleString()}</span>
                    {s.isBookable && <span style={{ color: theme.accent, border: `1px solid ${theme.accent}` }} className="rounded-full px-2.5 py-1 text-[11px] font-semibold">Bookable</span>}
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
    <section id="about" style={{ maxWidth: 780 }} className="mx-auto px-6 pb-16 pt-4">
      <h2 style={{ fontFamily: theme.headlineFont }} className="mb-4 text-2xl font-bold">About</h2>
      <p style={{ opacity: 0.85 }} className="text-base leading-relaxed">{store.business.description}</p>
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
    <section style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-14 pt-4">
      <h2 style={{ fontFamily: theme.headlineFont }} className="mb-5 text-2xl font-bold">
        Shop by category
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
        {categories.map(([name, count]) => (
          <a
            key={name}
            href="#catalog"
            style={{ borderRadius: theme.radius, background: theme.card, boxShadow: "0 1px 3px rgba(18,18,18,0.06)", color: theme.ink }}
            className="flex flex-col items-center gap-2 px-3 py-5 text-center no-underline transition-shadow hover:shadow-md"
          >
            <span
              style={{ background: `${theme.accent}1a`, color: theme.accent }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold"
            >
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-semibold">{name}</span>
            <span style={{ opacity: 0.55 }} className="text-xs">{count} item{count !== 1 ? "s" : ""}</span>
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
    <section style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-10 pt-2">
      <div
        style={{ borderRadius: theme.radius, background: LUMINA_INVERSE, color: LUMINA_INVERSE_INK }}
        className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden px-8 py-8"
      >
        <div style={{ background: `${theme.accent}33` }} className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="relative z-10">
          <p style={{ opacity: 0.85 }} className="mb-1.5 text-xs font-semibold uppercase tracking-widest">
            Deal of the day · {pctOff}% off
          </p>
          <h3 style={{ fontFamily: theme.headlineFont }} className="text-2xl font-bold">{product.name}</h3>
          <p className="mt-2 text-base">
            <span className="font-bold">{product.currency} {price.toLocaleString()}</span>{" "}
            <span style={{ opacity: 0.7 }} className="line-through">{product.currency} {compareAt.toLocaleString()}</span>
          </p>
        </div>
        <a
          href="#catalog"
          style={{ background: theme.accent, color: "#fff" }}
          className="relative z-10 whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold no-underline transition-transform hover:-translate-y-0.5"
        >
          Shop the deal →
        </a>
      </div>
    </section>
  );
}

// Lumina "inverse surface" — the dark power-block used for high-contrast
// promo/CTA sections against the otherwise light, airy Lumina palette.
const LUMINA_INVERSE = "#293138";
const LUMINA_INVERSE_INK = "#E9F2FB";

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
    <section style={{ background: theme.card }} className="py-8">
      <div style={{ maxWidth: 1280 }} className="mx-auto flex flex-wrap justify-around gap-8 px-6">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <p style={{ fontFamily: theme.headlineFont, color: theme.accent }} className="text-3xl font-extrabold">{it.value}</p>
            <p style={{ opacity: 0.7 }} className="mt-1 text-xs">{it.label}</p>
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
    <section style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-14 pt-4">
      <h2 style={{ fontFamily: theme.headlineFont }} className="mb-5 text-2xl font-bold">Why shop here</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {items.map((it) => (
          <div key={it.title} style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="p-5">
            <span className="text-xl">{it.icon}</span>
            <p className="mt-2 text-sm font-semibold">{it.title}</p>
            <p style={{ opacity: 0.7 }} className="mt-1 text-[13px] leading-relaxed">{it.body}</p>
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
    <section style={{ background: theme.card }} className="px-6 py-10">
      <div style={{ maxWidth: 560 }} className="mx-auto text-center">
        <p style={{ fontFamily: theme.headlineFont }} className="text-lg font-semibold">Get notified about new drops</p>
        <p style={{ opacity: 0.7 }} className="mt-1 text-sm">No spam — just this store's updates.</p>
        <form action={subscribe} className="mt-4 flex flex-wrap justify-center gap-2">
          <input
            name="email" type="email" required placeholder="you@email.com"
            style={{ flex: "1 1 220px", borderRadius: "0.5rem", border: `1px solid ${theme.ink}33`, background: theme.bg, color: theme.ink }}
            className="px-4 py-2.5 text-sm outline-none"
          />
          <button style={{ background: theme.accent, color: "#fff" }} className="rounded-lg px-6 py-2.5 text-sm font-semibold">
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}

function Testimonials({ reviews, theme }: { reviews: StoreWithRelations["reviews"]; theme: TemplateTheme }) {
  return (
    <section style={{ maxWidth: 1280 }} className="mx-auto px-6 pb-16 pt-4">
      <h2 style={{ fontFamily: theme.headlineFont }} className="mb-5 text-2xl font-bold">What people say</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {reviews.slice(0, 3).map((r) => (
          <div key={r.id} style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="p-5">
            <div style={{ color: theme.accent }} className="mb-2 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
            <p style={{ opacity: 0.9 }} className="text-sm leading-relaxed">&ldquo;{r.comment}&rdquo;</p>
            <p style={{ opacity: 0.6 }} className="mt-2.5 text-xs">— {r.author.name ?? "Verified buyer"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact({ store, theme, social }: { store: StoreWithRelations; theme: TemplateTheme; social: Record<string, string> }) {
  return (
    <section id="contact" style={{ maxWidth: 780 }} className="mx-auto px-6 pb-16 pt-4">
      <h2 style={{ fontFamily: theme.headlineFont }} className="mb-4 text-2xl font-bold">Get in touch</h2>
      <div style={{ background: theme.card, borderRadius: theme.radius, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="flex flex-wrap gap-3 p-6">
        {social.whatsapp && (
          <a href={`https://wa.me/${social.whatsapp}`} style={{ background: theme.accent, color: "#fff" }} className="rounded-full px-6 py-2.5 text-sm font-semibold no-underline">
            Message on WhatsApp
          </a>
        )}
        {store.contactPhone && (
          <a href={`tel:${store.contactPhone}`} style={{ border: `1px solid ${theme.ink}33`, color: theme.ink }} className="rounded-full px-6 py-2.5 text-sm font-semibold no-underline">
            Call {store.contactPhone}
          </a>
        )}
        {store.contactEmail && (
          <a href={`mailto:${store.contactEmail}`} style={{ border: `1px solid ${theme.ink}33`, color: theme.ink }} className="rounded-full px-6 py-2.5 text-sm font-semibold no-underline">
            Email {store.contactEmail}
          </a>
        )}
      </div>
    </section>
  );
}
