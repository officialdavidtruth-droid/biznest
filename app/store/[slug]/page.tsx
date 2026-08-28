import type React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CartLink } from "@/components/storefront/cart-link";
import { resolveStoreTheme, FRESH, isSignatureTemplate, getSignatureTheme, isHeenzyTemplate, isNovaTemplate, isVioletTemplate, isPremiumTemplate, isHomeVistaTemplate, isRrwTemplate, isMarketplaceTemplate, isArcovaTemplate, isRivoraTemplate, isJuiceLifeTemplate, isFabtexTemplate, type TemplateTheme } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { getTrustScoreBreakdown, getTrustScoreChecklist } from "@/lib/actions/trust-score";
import { HeenzyStorefront } from "@/components/storefront/templates/heenzy-home";
import { NovaStorefront } from "@/components/storefront/templates/nova-home";
import { VioletStorefront } from "@/components/storefront/templates/violet-home";
import { PremiumStorefront } from "@/components/storefront/templates/premium-home";
import { HomeVistaStorefront } from "@/components/storefront/templates/homevista-home";
import { RrwStorefront } from "@/components/storefront/templates/rrw-home";
import { MarketplaceStorefront } from "@/components/storefront/templates/marketplace-home";
import { ArcovaStorefront } from "@/components/storefront/templates/arcova-home";
import { RivoraStorefront } from "@/components/storefront/templates/rivora-home";
import { JuiceLifeStorefront } from "@/components/storefront/templates/juicelife-home";
import { FabtexStorefront } from "@/components/storefront/templates/fabtex-home";
import { SignatureStorefront } from "@/components/storefront/templates/signature-home";
import { HotelStorefront } from "@/components/storefront/templates/hotel-home";
import { CategoryNav } from "@/components/storefront/category-nav";
import { getStoreCategoryTree } from "@/lib/storefront-categories";
import { Reveal } from "@/components/storefront/reveal";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { readBuilderConfig } from "@/lib/builder-config";
import { getHospitalityGallery } from "@/lib/actions/hospitality-content";

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

  // Fire-and-forget: never await-block a buyer's page render on analytics.
  void recordStoreVisit(store.id, `/${slug}`);

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);

  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const catalogItems: CatalogItem[] = [
    ...store.products.map((p) => ({
      id: p.id, kind: "product" as const, name: p.name, description: null as string | null,
      price: Number(p.price), currency: p.currency, image: p.images[0] ?? null,
      categoryName: p.category?.name ?? null, type: p.type, rentalUnit: p.rentalPeriodUnit,
      isBookable: false,
    })),
    ...store.services.map((s) => ({
      id: s.id, kind: "service" as const, name: s.name, description: s.description,
      price: Number(s.price), currency: s.currency, image: s.images[0] ?? null,
      categoryName: s.category?.name ?? null, type: "SERVICE", rentalUnit: null,
      isBookable: s.isBookable,
    })),
  ];
  const catalogCategories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];

  // Full category tree (with subcategories + counts) for the category nav
  // bar — a separate query from catalogItems above, since that one is
  // capped at 24 items per kind and shouldn't silently under-count.
  const navCategories = await getStoreCategoryTree(store.id);

  // Homepage only teases a handful of items — the full catalog lives on its
  // own page (/catalog) and each category has its own dedicated listing
  // page, same pattern as most real ecommerce sites (Jumia, Amazon, etc).
  const featuredItems = catalogItems.slice(0, 8);

  const goodReviews = store.reviews.filter((r) => r.rating >= 4 && r.comment);
  const avgRating = store.reviews.length
    ? store.reviews.reduce((sum, r) => sum + r.rating, 0) / store.reviews.length
    : null;
  const completedOrders = await prisma.order.count({ where: { storeId: store.id, status: { in: ["DELIVERED", "COMPLETED"] } } });

  // Trust Score is compute-on-read (see lib/actions/trust-score.ts) — cheap
  // enough for a single storefront page view. `business` can be null this
  // early in onboarding, in which case there's nothing to score yet.
  const trustScore = store.business ? (await getTrustScoreBreakdown(store.business.id))?.score ?? null : null;
  const trustChecklist = store.business ? await getTrustScoreChecklist(store.business.id) : null;

  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const storyImage = store.storyImage || store.bannerUrl || store.template?.previewUrl || null;
  const heroOverrides = store.heroOverrides as { headline?: string; subtitle?: string; ctaLabel?: string } | null;
  const storyOverrides = store.storyOverrides as { eyebrow?: string; heading?: string; body?: string } | null;

  // Legacy section visibility remains supported for stores that have not activated the visual builder.
  const sectionOverrides = store.sectionOverrides as { hidden?: string[] } | null;
  const hiddenSections = new Set(sectionOverrides?.hidden ?? []);

  // Stores that activate the visual builder render from the saved section graph.
  // Legacy stores keep their existing template renderer unchanged.
  const rawSectionOverrides = store.sectionOverrides as { builderVersion?: number; builder?: unknown } | null;
  const builderConfig = rawSectionOverrides?.builderVersion === 1 ? readBuilderConfig(rawSectionOverrides.builder) : null;
  if (builderConfig) {
    return (
      <BuilderStorefront
        store={store}
        config={builderConfig}
        catalogItems={catalogItems}
        reviews={store.reviews}
        avgRating={avgRating}
        completedOrders={completedOrders}
      />
    );
  }

  // ---------- HOTEL: company-first hospitality website ----------
  const signatureTheme = isSignatureTemplate(store.template?.name) ? getSignatureTheme(store.template?.name) : null;
  const hospitalityGallery = signatureTheme?.signatureMode === "hotel" ? await getHospitalityGallery(slug) : null;
  if (signatureTheme?.signatureMode === "hotel") {
    return (
      <HotelStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        goodReviews={goodReviews}
        avgRating={avgRating}
        social={social}
        theme={signatureTheme}
        galleryContent={hospitalityGallery}
      />
    );
  }

  // ---------- SIGNATURE COLLECTION: new industry-first designs ----------
  if (isSignatureTemplate(store.template?.name)) {
    return (
      <SignatureStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        completedOrders={completedOrders}
        social={social}
        theme={getSignatureTheme(store.template?.name)}
      />
    );
  }

  // ---------- TEMPLATE 2: Heenzy Sneaker Co. ----------
  if (isHeenzyTemplate(store.template?.name)) {
    return (
      <HeenzyStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        catalogCategories={catalogCategories}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 3: Nova Studio ----------
  if (isNovaTemplate(store.template?.name)) {
    return (
      <NovaStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
        theme={theme}
        heroOverrides={heroOverrides}
      />
    );
  }

  // ---------- TEMPLATE 4: Violet ----------
  if (isVioletTemplate(store.template?.name)) {
    return (
      <VioletStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
        theme={theme}
        heroOverrides={heroOverrides}
      />
    );
  }

  // ---------- TEMPLATE 5: Premium Marketplace ----------
  if (isPremiumTemplate(store.template?.name)) {
    return (
      <PremiumStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 6: HomeVista ----------
  if (isHomeVistaTemplate(store.template?.name)) {
    return (
      <HomeVistaStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 7: rRW Premium Rental ----------
  if (isRrwTemplate(store.template?.name)) {
    return (
      <RrwStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 8: Marketplace Hub ----------
  if (isMarketplaceTemplate(store.template?.name)) {
    return (
      <MarketplaceStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 9: Arcova Architecture ----------
  if (isArcovaTemplate(store.template?.name)) {
    return (
      <ArcovaStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 10: Rivora Fresh ----------
  if (isRivoraTemplate(store.template?.name)) {
    return (
      <RivoraStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 11: JuiceLife ----------
  if (isJuiceLifeTemplate(store.template?.name)) {
    return (
      <JuiceLifeStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  // ---------- TEMPLATE 12: Fabtex ----------
  if (isFabtexTemplate(store.template?.name)) {
    return (
      <FabtexStorefront
        store={store}
        slug={slug}
        catalogItems={catalogItems}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        trustScore={trustScore}
        trustChecklist={trustChecklist}
        completedOrders={completedOrders}
        social={social}
      />
    );
  }

  return (
    <div style={{ fontFamily: theme.font, color: theme.ink, background: FRESH.ivory }} className="storefront-root">
      <SiteNav store={store} slug={slug} hasCatalog={catalogItems.length > 0} />
      <CategoryNav slug={slug} categories={navCategories} accent={FRESH.leaf} ink={FRESH.ink} bg={FRESH.ivory} border={line} />

      {/* ---------- HERO ---------- */}
      <header style={{ padding: "36px 0 0", background: FRESH.ivory }}>
        <div style={wrap}>
          <div
            style={{
              position: "relative", borderRadius: 26, overflow: "hidden", minHeight: 460,
              display: "flex", alignItems: "center",
              boxShadow: "0 40px 80px -36px rgba(10,30,18,0.45)",
              background: heroImage
                ? `linear-gradient(100deg, rgba(10,30,18,.82) 0%, rgba(10,30,18,.58) 38%, rgba(10,30,18,.12) 62%), url(${heroImage}) center/cover`
                : `linear-gradient(200deg,#5fc98a 0%, #2c8a52 45%, #1c5c37 100%)`,
            }}
          >
            <div style={{ position: "relative", zIndex: 2, padding: "60px 56px", maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ ...eyebrow, color: FRESH.citrus }}>{theme.eyebrow}</div>
                {store.business.verificationBadge && <VerifiedBadge />}
              </div>
              <h1 style={{ ...h1, color: "#fff", fontSize: "clamp(34px,5vw,56px)" }}>{heroOverrides?.headline || store.name}</h1>
              <p style={{ marginTop: 18, color: "rgba(255,255,255,.82)", maxWidth: 440, fontSize: 15.5, lineHeight: 1.6 }}>
                {heroOverrides?.subtitle || store.business.description || theme.sub}
              </p>
              <div style={{ marginTop: 30, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {catalogItems.length > 0 && (
                  <a href="#catalog" style={btnPrimary}>{heroOverrides?.ctaLabel || theme.cta} <ArrowChip /></a>
                )}
              </div>
            </div>
            {avgRating != null && (
              <div style={{ position: "absolute", zIndex: 2, bottom: 34, right: 40, background: "#fff", color: FRESH.forest, padding: "14px 18px", borderRadius: 16, boxShadow: shadow, fontSize: 12 }}>
                <div style={{ color: FRESH.citrus, letterSpacing: 2, fontSize: 13 }}>{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</div>
                <b style={{ display: "block", fontFamily: FRESH.headlineFont, fontSize: 19, color: FRESH.forest, fontWeight: 800 }}>{avgRating.toFixed(1)} Rating</b>
                {store.reviews.length}+ glowing reviews
              </div>
            )}
          </div>

          {!hiddenSections.has("stats") && (
            <div style={{ display: "flex", gap: 36, padding: "34px 0 0", flexWrap: "wrap" }}>
              {catalogItems.length > 0 && <Stat value={`${catalogItems.length}+`} label="Services offered" />}
              {completedOrders > 0 && <Stat value={`${completedOrders}+`} label="Jobs completed" />}
              {avgRating != null && <Stat value={`${avgRating.toFixed(1)}/5`} label="Average rating" />}
            </div>
          )}

          <Marquee />
        </div>
      </header>

      {/* ---------- WHY CHOOSE US ---------- */}
      {store.business.description && !hiddenSections.has("about") && (
        <section style={{ padding: "80px 0" }}>
          <Reveal style={{ ...wrap, display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 50, alignItems: "center" }}>
            <div>
              <div style={eyebrow}>Why choose us</div>
              <h2 style={{ ...h1, fontSize: "clamp(26px,3.6vw,38px)", marginBottom: 16 }}>
                Why should you choose <span style={accentText}>our services?</span>
              </h2>
              <p style={{ color: FRESH.inkSoft, fontSize: 14.5, lineHeight: 1.7, maxWidth: 420 }}>{store.business.description}</p>
              {catalogCategories.slice(0, 3).map((cat, i) => (
                <div key={cat} style={{ display: "flex", gap: 16, padding: "18px 0", borderTop: `1px solid ${line}` }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: FRESH.leaf, paddingTop: 4 }}>{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <h4 style={{ fontSize: 17, marginBottom: 6, fontFamily: FRESH.headlineFont, fontWeight: 700 }}>{cat}</h4>
                    <p style={{ color: FRESH.inkSoft, fontSize: 14, lineHeight: 1.6 }}>Trained crews and quality service, every time.</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Tile img={store.logoUrl} gradient={`linear-gradient(150deg,${FRESH.leafLight},${FRESH.forest})`} />
              <Tile img={heroImage} gradient={`linear-gradient(150deg,${FRESH.citrus},#c98a12)`} marginTop={32} />
            </div>
          </Reveal>
        </section>
      )}

      {/* ---------- BEST SELLERS — a teaser, not the full catalog ---------- */}
      {featuredItems.length > 0 && !hiddenSections.has("catalog") && (
        <section id="catalog" style={{ padding: "80px 0", background: FRESH.paper }}>
          <div style={wrap}>
            <Reveal>
              <div style={sectionHead}>
                <div>
                  <div style={eyebrow}>Our {theme.catalogLabel.toLowerCase()}</div>
                  <h2 style={h2}>Our company provides the <span style={accentText}>best service</span></h2>
                </div>
                <a href={`/${slug}/catalog`} style={btnGhost}>View all {theme.catalogLabel.toLowerCase()} →</a>
              </div>
            </Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {featuredItems.map((item, i) => (
                <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 60}>
                  <CatalogCard item={item} storeName={store.name} slug={slug} accent={FRESH.leaf} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- STORY / CTA (dark block) ---------- */}
      {store.business.description && !hiddenSections.has("about") && (
        <section style={{ padding: "80px 0" }}>
          <div style={wrap}>
            <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", borderRadius: 24, overflow: "hidden", background: FRESH.forest, color: "#fff" }}>
              <div style={{ padding: "60px 50px" }}>
                <div style={{ ...eyebrow, color: FRESH.citrus }}>{storyOverrides?.eyebrow || "What we do"}</div>
                <h2 style={{ ...h1, color: "#fff", fontSize: "clamp(26px,3.2vw,38px)" }}>
                  {storyOverrides?.heading || <>Behind the <span style={{ color: FRESH.leafLight }}>{store.name}</span> story.</>}
                </h2>
                <p style={{ color: "rgba(255,255,255,.65)", marginTop: 16, maxWidth: 400, fontSize: 15, lineHeight: 1.7 }}>{storyOverrides?.body || store.business.description}</p>
                <div style={{ display: "flex", gap: 36, marginTop: 34 }}>
                  {catalogItems.length > 0 && <div><b style={{ fontFamily: FRESH.headlineFont, fontSize: 28, color: FRESH.citrus, display: "block" }}>{catalogItems.length}+</b><span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>Services offered</span></div>}
                  {completedOrders > 0 && <div><b style={{ fontFamily: FRESH.headlineFont, fontSize: 28, color: FRESH.citrus, display: "block" }}>{completedOrders}+</b><span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>Jobs completed</span></div>}
                </div>
                {catalogItems.length > 0 && <a href="#catalog" style={{ ...btnPrimary, marginTop: 30 }}>Get Started <ArrowChip /></a>}
              </div>
              <div style={{ position: "relative", background: storyImage ? `url(${storyImage}) center/cover` : `linear-gradient(160deg,#1c4a32,#0a1f15)`, minHeight: 280 }} />
            </div>
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIALS ---------- */}
      {goodReviews.length > 0 && !hiddenSections.has("testimonials") && (
        <section style={{ padding: "80px 0" }}>
          <Reveal style={{ ...wrap, display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 44, alignItems: "center" }}>
            <div style={{ height: 300, borderRadius: 24, background: heroImage ? `url(${heroImage}) center/cover` : `linear-gradient(150deg,${FRESH.leafLight},${FRESH.forest})`, position: "relative" }}>
              {avgRating != null && (
                <div style={{ position: "absolute", bottom: 18, left: 18, background: "#fff", borderRadius: 14, padding: "10px 14px", boxShadow: shadow }}>
                  <b style={{ fontFamily: FRESH.headlineFont, fontSize: 18 }}>{avgRating.toFixed(1)} / 5</b>
                  <span style={{ fontSize: 11, color: FRESH.inkSoft, display: "block" }}>{store.reviews.length}+ reviews</span>
                </div>
              )}
            </div>
            <div>
              <div style={eyebrow}>What clients say</div>
              <h2 style={{ ...h2, marginBottom: 22 }}>Hear what our <span style={accentText}>clients</span> say</h2>
              <div style={{ color: FRESH.citrus, letterSpacing: 3, marginBottom: 16, fontSize: 15 }}>{"★".repeat(goodReviews[0].rating)}</div>
              <p style={{ fontFamily: FRESH.headlineFont, fontSize: "clamp(18px,2.4vw,26px)", lineHeight: 1.5, color: FRESH.forest, fontWeight: 700 }}>
                &ldquo;{goodReviews[0].comment}&rdquo;
              </p>
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(150deg,${FRESH.leafLight},${FRESH.forest})` }} />
                <div>
                  <h5 style={{ fontSize: 14, fontWeight: 700 }}>{goodReviews[0].author.name ?? "Verified client"}</h5>
                  <span style={{ fontSize: 12, color: FRESH.inkSoft }}>Client</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* ---------- APPOINTMENT / QUOTE ---------- */}
      <section style={{ padding: "80px 0", background: FRESH.paper }}>
        <div style={wrap}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ background: FRESH.forestDark, color: "#fff", padding: 50 }}>
              <div style={{ ...eyebrow, color: FRESH.citrus }}>Get a quote</div>
              <h2 style={{ ...h1, color: "#fff", fontSize: "clamp(24px,3vw,32px)" }}>
                Schedule your <span style={{ color: FRESH.leafLight }}>appointment</span> today!
              </h2>
              <p style={{ color: "rgba(255,255,255,.6)", marginTop: 10, fontSize: 14 }}>Tell us about your needs and we&apos;ll reply within the hour.</p>
              <QuoteForm slug={slug} services={catalogItems.map((i) => i.name)} contactEmail={store.contactEmail} social={social} />
            </div>
            <div style={{ position: "relative", background: `linear-gradient(155deg,${FRESH.leafLight},#0d281b)`, minHeight: 260 }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: FRESH.leaf, padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <h4 style={{ color: "#fff", fontSize: 18, fontFamily: FRESH.headlineFont, fontWeight: 700 }}>100% Satisfaction</h4>
                <span style={{ color: "rgba(255,255,255,.75)", fontSize: 12 }}>Guaranteed on every visit</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CONTACT ---------- */}
      {(store.contactEmail || store.contactPhone || social.whatsapp) && !hiddenSections.has("contact") && (
        <section style={{ padding: "80px 0" }}>
          <div style={{ ...wrap, maxWidth: 780 }}>
            <h2 style={{ ...h2, marginBottom: 16, fontSize: 26 }}>Get in touch</h2>
            <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${line}`, display: "flex", flexWrap: "wrap", gap: 12, padding: 24 }}>
              {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={btnPrimary}>Message on WhatsApp</a>}
              {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={btnGhost}>Call {store.contactPhone}</a>}
              {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={btnGhost}>Email {store.contactEmail}</a>}
            </div>
          </div>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      {!hiddenSections.has("newsletter") && <NewsletterSection slug={slug} storeName={store.name} />}

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: FRESH.forestDark, color: "rgba(255,255,255,.6)", padding: "60px 0 0" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 36, paddingBottom: 44, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} />
              ) : (
                <div style={{ height: 26, width: 26, borderRadius: 6, background: FRESH.citrus }} />
              )}
              <span style={{ fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: 15, color: "#fff" }}>{store.name}</span>
            </div>
            {store.business.description && (
              <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 250 }}>
                {store.business.description.length > 140 ? store.business.description.slice(0, 140) + "…" : store.business.description}
              </p>
            )}
          </div>
          <div>
            <h5 style={footHead}>Services</h5>
            {catalogCategories.slice(0, 4).map((c) => <div key={c} style={footLink}>{c}</div>)}
          </div>
          <div>
            <h5 style={footHead}>Pages</h5>
            <div style={footLink}>Home</div>
            {catalogItems.length > 0 && <div style={footLink}>{theme.catalogLabel}</div>}
            <div style={footLink}>Contact</div>
          </div>
          <div>
            <h5 style={footHead}>Get in touch</h5>
            {store.contactEmail && <div style={footLink}>{store.contactEmail}</div>}
            {store.contactPhone && <div style={footLink}>{store.contactPhone}</div>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "22px 28px", fontSize: 12, flexWrap: "wrap", gap: 8, maxWidth: 1180, margin: "0 auto" }}>
          <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
          <span>Powered by BizNest</span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared style tokens (Fresh & Co. palette — lib/template-themes.ts FRESH)
// ---------------------------------------------------------------------------
const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" };
const line = "rgba(18,53,36,0.10)";
const shadow = "0 18px 44px -22px rgba(13,40,27,0.35)";
const eyebrow: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: FRESH.leaf, fontWeight: 600, marginBottom: 14 };
const h1: React.CSSProperties = { fontFamily: FRESH.headlineFont, fontWeight: 700, lineHeight: 1.14, letterSpacing: "-0.01em" };
const h2: React.CSSProperties = { ...h1, fontSize: "clamp(26px,3.4vw,40px)", maxWidth: 560 };
const accentText: React.CSSProperties = { color: FRESH.leaf, fontWeight: 800 };
const sectionHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30, marginBottom: 46, flexWrap: "wrap" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 26px", borderRadius: 100, fontWeight: 600, fontSize: 15, background: FRESH.leaf, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 26px", borderRadius: 100, fontWeight: 600, fontSize: 15, background: "transparent", color: FRESH.forest, border: "1.5px solid " + line, textDecoration: "none", whiteSpace: "nowrap" };
const footHead: React.CSSProperties = { color: "#fff", fontFamily: "monospace", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 };
const footLink: React.CSSProperties = { fontSize: 13.5, marginBottom: 10 };

function ArrowChip() {
  return <span style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>→</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b style={{ fontFamily: FRESH.headlineFont, fontSize: 25, display: "block", color: FRESH.forest, fontWeight: 800 }}>{value}</b>
      <span style={{ fontSize: 12.5, color: FRESH.inkSoft }}>{label}</span>
    </div>
  );
}

// Shown only when Business.verificationBadge is true — set by a platform
// admin after reviewing the business's verification documents (see
// app/supaadmin/businesses). Never inferred client-side; always the raw DB
// flag, so this can't drift from what an admin actually approved.
function VerifiedBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        background: "rgba(255,255,255,.16)",
        border: "1px solid rgba(255,255,255,.3)",
        fontSize: 11.5,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: 0.2,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 1.5l2.13 1.7 2.72-.28.7 2.65 2.5 1.15-1.02 2.58 1.02 2.58-2.5 1.15-.7 2.65-2.72-.28L10 18.5l-2.13-1.7-2.72.28-.7-2.65-2.5-1.15L2.97 10 1.95 7.42l2.5-1.15.7-2.65 2.72.28L10 1.5z" opacity="0.35" />
        <path fillRule="evenodd" clipRule="evenodd" d="M13.4 7.4a.75.75 0 010 1.06l-3.75 3.75a.75.75 0 01-1.06 0L6.6 10.2a.75.75 0 111.06-1.06l1.44 1.44 3.22-3.22a.75.75 0 011.08.04z" />
      </svg>
      Verified business
    </span>
  );
}

function Tile({ img, gradient, marginTop }: { img: string | null; gradient: string; marginTop?: number }) {
  return (
    <div style={{ borderRadius: 20, height: 210, marginTop, overflow: "hidden", background: img ? `url(${img}) center/cover` : gradient }} />
  );
}

function Marquee() {
  const words = ["VACUUM", "CLEANING", "SWEEPING", "SANITIZE", "POLISH", "DUSTING"];
  return (
    <div style={{ borderTop: `1px solid ${line}`, padding: "22px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: 19, color: line }}>
        {[...words, ...words].map((w, i) => (
          <span key={i} style={{ margin: "0 22px", color: i % 2 === 0 ? FRESH.leaf : "#d8ded9" }}>{w}</span>
        ))}
      </span>
    </div>
  );
}

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};


function CatalogCard({ item, storeName, slug, accent }: { item: CatalogItem; storeName: string; slug: string; accent: string }) {
  const href = `/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`;
  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: `1px solid ${line}`, boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }}>
      <a href={href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        <div style={{ height: 160, background: `linear-gradient(140deg,${FRESH.mint2},${FRESH.leafLight})`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 30, opacity: 0.4 }}>{storeName.charAt(0)}</span>
          )}
        </div>
        <div style={{ padding: "20px 20px 0" }}>
          {item.categoryName && <div style={{ fontFamily: "monospace", fontSize: 10.5, color: FRESH.leaf, textTransform: "uppercase", marginBottom: 8 }}>{item.categoryName}</div>}
          <h4 style={{ fontSize: 16.5, marginBottom: 8, fontFamily: FRESH.headlineFont, fontWeight: 700 }}>{item.name}</h4>
          {item.description && <p style={{ fontSize: 13, color: FRESH.inkSoft, lineHeight: 1.5, marginBottom: 16 }}>{item.description.length > 100 ? item.description.slice(0, 100) + "…" : item.description}</p>}
        </div>
      </a>
      <div style={{ padding: "0 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FRESH.headlineFont, fontSize: 20, fontWeight: 600, color: FRESH.forest }}>
            {item.currency} {item.price.toLocaleString()}
          </span>
          <a href={href} style={{ ...btnGhost, padding: "9px 16px", fontSize: 12.5 }}>
            {item.kind === "service" ? (item.isBookable ? "Book now" : "View details") : "View & buy"}
          </a>
        </div>
      </div>
    </div>
  );
}

function SiteNav({ store, slug, hasCatalog }: { store: { name: string; logoUrl: string | null }; slug: string; hasCatalog: boolean }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(251,249,244,.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${line}` }}>
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px" }}>
        <a href={`/${slug}`} style={{ fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: 23, color: FRESH.forest, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: FRESH.citrus, display: "inline-block" }} />
          )}
          {store.name}
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {hasCatalog && <a href={`/${slug}/search`} style={{ fontSize: 14.5, fontWeight: 500, color: FRESH.inkSoft, textDecoration: "none" }}>Search</a>}
          {hasCatalog && <a href="#catalog" style={{ fontSize: 14.5, fontWeight: 500, color: FRESH.inkSoft, textDecoration: "none" }}>Services</a>}
          <CartLink storeSlug={slug} accent={FRESH.leaf} ink={FRESH.ink} />
          {hasCatalog && <a href="#catalog" style={{ ...btnPrimary, padding: "11px 20px", fontSize: 13.5 }}>Get a Quote</a>}
        </div>
      </div>
    </nav>
  );
}

function QuoteForm({ slug, services, contactEmail, social }: { slug: string; services: string[]; contactEmail: string | null; social: Record<string, string> }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  return (
    <form action={subscribe} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 26 }}>
      <Field label="First name"><input name="firstName" placeholder="Jordan" style={input} /></Field>
      <Field label="Last name"><input name="lastName" placeholder="Avery" style={input} /></Field>
      <Field label="Email address" full><input name="email" type="email" required placeholder="you@email.com" style={input} /></Field>
      {services.length > 0 && (
        <Field label="Service" full>
          <select name="service" style={input}>
            {services.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      )}
      <div style={{ gridColumn: "1/-1" }}>
        <button type="submit" style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>Request a Service <ArrowChip /></button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1/-1" : undefined }}>
      <label style={{ display: "block", fontSize: 11.5, color: "rgba(255,255,255,.55)", marginBottom: 7, fontFamily: "monospace" }}>{label}</label>
      {children}
    </div>
  );
}

const input: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14 };

function NewsletterSection({ slug, storeName }: { slug: string; storeName: string }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  return (
    <section style={{ padding: "60px 0", background: FRESH.paper }}>
      <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Stay up to date</div>
          <h2 style={{ ...h1, fontSize: "clamp(22px,3vw,30px)" }}>Join the <span style={accentText}>{storeName}</span> newsletter</h2>
        </div>
        <form action={subscribe} style={{ display: "flex", borderRadius: 100, overflow: "hidden", border: `1.5px solid ${line}`, background: "#fff", minWidth: 320 }}>
          <input name="email" type="email" required placeholder="Enter your email address" style={{ flex: 1, border: "none", padding: "15px 18px", fontSize: 14, background: "transparent", outline: "none" }} />
          <button type="submit" style={{ background: FRESH.leaf, color: "#fff", padding: "15px 22px", fontWeight: 600, fontSize: 13, border: "none" }}>Subscribe →</button>
        </form>
      </div>
    </section>
  );
}
