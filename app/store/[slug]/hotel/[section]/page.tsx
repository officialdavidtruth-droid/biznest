import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import {
  ArrowUpRight, Clock3, Mail, MapPin, Phone, Star, Heart, Gem, UserCheck, Building2,
  ShieldCheck, Leaf, Eye, Play, Headphones, Camera, Users, Sparkles,
} from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, getSignatureTheme, isSignatureTemplate, type TemplateTheme } from "@/lib/template-themes";
import { getHospitalityGallery } from "@/lib/actions/hospitality-content";
import { resolveHeroMedia } from "@/lib/storefront/hero-media";
import { RoomsSuitesListing, type ListingItem } from "@/components/storefront/templates/rooms-suites-listing";
import { HotelHeader, HotelFooter } from "@/components/storefront/templates/hotel-chrome";
import { HotelGalleryBrowser } from "@/components/storefront/templates/hotel-gallery-browser";
import { HotelExperienceGrid } from "@/components/storefront/templates/hotel-experience-grid";
import { getUnitBookingNiche } from "@/lib/storefront/unit-booking-niche";

const ROOM_PATTERN = /room|suite|studio|apartment|villa|penthouse|chalet|cottage|lodge|duplex/i;
const SECTIONS = ["story", "rooms", "experience", "gallery", "contact"] as const;
type Section = (typeof SECTIONS)[number];

type Item = {
  id: string;
  kind: "product" | "service";
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image: string | null;
  categoryName: string | null;
  isBookable: boolean;
  attributes?: Record<string, unknown> | null;
};

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\n,•|]+/).map((v) => v.trim()).filter(Boolean);
}

function pageHero(theme: TemplateTheme, dark: string, heroImage: string | null, eyebrow: string, title: string, body?: string, quote?: string) {
  return (
    <section
      style={{
        position: "relative",
        minHeight: 360,
        display: "flex",
        alignItems: "flex-end",
        color: "#fff",
        padding: "90px 28px 56px",
        background: heroImage
          ? `linear-gradient(180deg, rgba(8,7,6,.2) 0%, rgba(8,7,6,.34) 45%, rgba(8,7,6,.88) 100%), url(${heroImage}) center/cover`
          : `linear-gradient(135deg, ${dark}, ${theme.accent})`,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ color: theme.accentSoft || theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>{eyebrow}</div>
          <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(40px, 6vw, 76px)", lineHeight: .96, letterSpacing: "-.05em", margin: "14px 0 0", fontWeight: 650 }}>{title}</h1>
          {body && <p style={{ color: "rgba(255,255,255,.78)", fontSize: 15, lineHeight: 1.8, maxWidth: 620, margin: "18px 0 0" }}>{body}</p>}
        </div>
        {quote && (
          <div style={{ maxWidth: 240, textAlign: "right", borderRight: `2px solid ${theme.accent}`, paddingRight: 18 }}>
            <span style={{ fontFamily: theme.headlineFont, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: "rgba(255,255,255,.9)" }}>&ldquo;{quote}&rdquo;</span>
          </div>
        )}
      </div>
    </section>
  );
}

function ctaBanner(theme: TemplateTheme, dark: string, image: string | null, eyebrow: string, title: string, body: string, ctaLabel: string, ctaHref: string, items: { icon: React.ElementType; label: string; sublabel?: string }[]) {
  return (
    <section style={{ position: "relative", padding: "70px 28px", color: "#fff", background: image ? `linear-gradient(90deg, rgba(10,8,6,.88) 0%, rgba(10,8,6,.55) 60%, rgba(10,8,6,.75) 100%), url(${image}) center/cover` : dark }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ color: theme.accentSoft || theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>{eyebrow}</div>
          <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(28px, 4vw, 40px)", margin: "12px 0 10px", lineHeight: 1.08 }}>{title}</h2>
          <p style={{ color: "rgba(255,255,255,.78)", fontSize: 14, margin: "0 0 22px" }}>{body}</p>
          <Link href={ctaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 20px", background: theme.accent, color: "#fff", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12.5 }}>{ctaLabel} <ArrowUpRight size={14} /></Link>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {items.map((it) => (
            <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", minWidth: 90 }}>
              <it.icon size={22} color={theme.accentSoft || theme.accent} />
              <strong style={{ fontSize: 12.5 }}>{it.label}</strong>
              {it.sublabel && <span style={{ fontSize: 11, color: "rgba(255,255,255,.65)" }}>{it.sublabel}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function sectionTitle(theme: TemplateTheme, eyebrow: string, title: string, body?: string) {
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>{eyebrow}</div>
      <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(44px, 7vw, 86px)", lineHeight: .94, letterSpacing: "-.055em", margin: "14px 0 0", fontWeight: 650 }}>{title}</h1>
      {body && <p style={{ color: theme.muted || `${theme.ink}99`, fontSize: 16, lineHeight: 1.85, maxWidth: 700, margin: "22px 0 0" }}>{body}</p>}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; section: string }> }): Promise<Metadata> {
  const { slug, section } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store) return { title: "Hotel" };
  const labels: Record<string, string> = { story: "The Hotel", rooms: "Rooms & Suites", experience: "Experience", gallery: "Gallery", contact: "Contact" };
  return { title: `${labels[section] || "Hotel"} — ${store.name}` };
}

export default async function HotelSectionPage({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const { slug, section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true, reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 12 }, products: { where: { isPublished: true }, include: { category: true }, take: 50 }, services: { where: { isPublished: true }, include: { category: true }, take: 50 } },
  });
  if (!store || store.status !== "ACTIVE") notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme: TemplateTheme = isSignatureTemplate(store.template?.name)
    ? getSignatureTheme(store.template?.name)
    : resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const profileRaw = store.onboardingProfile && typeof store.onboardingProfile === "object" ? store.onboardingProfile as Record<string, unknown> : {};
  const amenities = listValue(profileRaw.amenities);
  const checkInOut = listValue(profileRaw.checkInOut);
  const items: Item[] = [
    ...store.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, description: null, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, isBookable: false })),
    ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, isBookable: s.isBookable, attributes: (s.attributes && typeof s.attributes === "object" ? s.attributes : null) as Record<string, unknown> | null })),
  ];
  const rooms = items.filter((i) => ROOM_PATTERN.test(`${i.name} ${i.categoryName ?? ""}`));
  const roomItems = rooms.length ? rooms : items.filter((i) => i.kind === "product");
  const experiences = items.filter((i) => i.kind === "service" && !ROOM_PATTERN.test(`${i.name} ${i.categoryName ?? ""}`));
  const galleryContent = section === "gallery" ? await getHospitalityGallery(slug) : null;
  const gallery = galleryContent?.albums.flatMap((album) => album.images.map((image) => image.image)).filter(Boolean) ?? Array.from(new Set([store.bannerUrl, store.storyImage, ...items.map((i) => i.image)].filter(Boolean) as string[])).slice(0, 12);
  const location = [store.business.city, store.business.state, store.business.country].filter(Boolean).join(", ");
  const avgRating = store.reviews.length ? store.reviews.reduce((sum, r) => sum + r.rating, 0) / store.reviews.length : null;
  const muted = theme.muted || `${theme.ink}99`;
  const dark = theme.surfaceDark || "#171411";
  const heroImage = store.bannerUrl || store.storyImage || roomItems.find((i) => i.image)?.image || gallery[0] || null;
  const heroMedia = resolveHeroMedia(store.bannerUrl);
  const yearsActive = Math.max(0, Math.floor((Date.now() - store.createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000)));
  // Drives labels/copy/amenities/add-ons for this same rooms/booking UI
  // across niches (hotel, short-let, event venue, vehicle rental…) — see
  // lib/storefront/unit-booking-niche.ts. Store owners can override any of
  // it per-store via storefrontConfig.unitBooking.
  const niche = getUnitBookingNiche(store.businessType, store.storefrontConfig);

  const shell = (content: React.ReactNode) => <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font, minHeight: "100vh" }}><HotelHeader slug={slug} theme={theme} store={store} active={section as Section} itemLabelPlural={niche.itemLabelPlural} /><main>{content}</main><HotelFooter slug={slug} theme={theme} store={store} itemLabelPlural={niche.itemLabelPlural} /></div>;

  if (section === "story") return shell(<>
    {pageHero(theme, dark, heroImage, "Our story", `More Than a ${niche.rateUnit === "night" ? "Stay" : "Visit"}, A Story of Excellence`, `At ${store.name}, we believe hospitality is more than a service — it's a cherished experience.`, "People. Hospitality. A Better Tomorrow.")}

    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
      <nav style={{ display: "flex", gap: 28, flexWrap: "wrap", borderBottom: `1px solid ${theme.border || `${theme.ink}18`}`, padding: "22px 0", fontSize: 13, fontWeight: 700 }}>
        <a href="#our-story" style={{ color: theme.accent, textDecoration: "none", borderBottom: `2px solid ${theme.accent}`, paddingBottom: 6 }}>Our Story</a>
        <a href="#our-mission" style={{ color: theme.ink, opacity: 0.7, textDecoration: "none" }}>Our Mission</a>
        <a href="#why-choose-us" style={{ color: theme.ink, opacity: 0.7, textDecoration: "none" }}>Why Guests Choose Us</a>
      </nav>
    </div>

    <section id="our-story" style={{ padding: "60px 28px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
        <div>
          <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>About {store.name}</div>
          <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(30px, 4vw, 42px)", lineHeight: 1.06, margin: "14px 0 18px" }}>A Legacy of Exceptional Hospitality</h2>
          <p style={{ color: muted, lineHeight: 1.85, fontSize: 14.5 }}>{store.business.description || `${store.name} is dedicated to providing world-class accommodation, attentive service and personalized experiences that create unforgettable stays for every guest.`}</p>
          <p style={{ color: muted, lineHeight: 1.85, fontSize: 14.5, marginTop: 14 }}>Founded on the principles of excellence, comfort and genuine care, we blend modern elegance with authentic hospitality — whether you're here for business, leisure, or a special celebration.</p>
          <Link href={`/store/${slug}/hotel/contact`} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 24, padding: "13px 20px", background: theme.accent, color: "#fff", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12.5 }}>Get in Touch <ArrowUpRight size={14} /></Link>
        </div>
        <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: theme.radius, overflow: "hidden", background: store.storyImage || store.bannerUrl ? `url(${store.storyImage || store.bannerUrl}) center/cover` : `linear-gradient(135deg, ${dark}, ${theme.accent})` }}>
          {heroMedia.type !== "none" && heroMedia.type !== "image" && (
            <div style={{ position: "absolute", right: 16, bottom: 16, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 30, background: "rgba(10,8,6,.7)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              <Play size={13} fill="#fff" /> Watch Our Story
            </div>
          )}
        </div>
      </div>
    </section>

    <section style={{ padding: "0 28px 60px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", border: `1px solid ${theme.border || `${theme.ink}18`}`, borderRadius: theme.radius, padding: "30px 20px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, textAlign: "center", background: theme.card }}>
        <div><div style={{ fontFamily: theme.headlineFont, fontSize: 30, fontWeight: 700 }}>{roomItems.length}+</div><div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{niche.itemLabelPlural}</div></div>
        <div><div style={{ fontFamily: theme.headlineFont, fontSize: 30, fontWeight: 700 }}>{avgRating != null ? avgRating.toFixed(1) : "—"}</div><div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Average Guest Rating</div></div>
        <div><div style={{ fontFamily: theme.headlineFont, fontSize: 30, fontWeight: 700 }}>{store.reviews.length}+</div><div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Guest Reviews</div></div>
        <div><div style={{ fontFamily: theme.headlineFont, fontSize: 30, fontWeight: 700 }}>{yearsActive > 0 ? `${yearsActive}+` : "New"}</div><div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{yearsActive > 0 ? "Years of Service" : "Recently Opened"}</div></div>
      </div>
    </section>

    <section id="our-mission" style={{ padding: "20px 28px 80px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
        <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: theme.radius, overflow: "hidden", background: roomItems[0]?.image ? `url(${roomItems[0].image}) center/cover` : `linear-gradient(135deg, ${dark}, ${theme.accent})`, display: "flex", alignItems: "flex-end", padding: 24 }}>
          <span style={{ color: "#fff", fontFamily: theme.headlineFont, fontStyle: "italic", fontSize: 17, lineHeight: 1.4, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>&ldquo;Hospitality is not just what we do, it's who we are.&rdquo;</span>
        </div>
        <div>
          <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Our Mission</div>
          <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(28px, 4vw, 38px)", margin: "14px 0 16px" }}>To Create Meaningful Experiences</h2>
          <p style={{ color: muted, lineHeight: 1.85, fontSize: 14.5, marginBottom: 20 }}>We are committed to delivering exceptional hospitality through outstanding service, elegant spaces and a people-first approach that exceeds expectations.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ border: `1px solid ${theme.border || `${theme.ink}18`}`, borderRadius: theme.radius, padding: 16 }}>
              <Eye size={18} color={theme.accent} />
              <strong style={{ display: "block", fontSize: 13.5, margin: "10px 0 6px" }}>Our Vision</strong>
              <span style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>To be a trusted, preferred name in hospitality, known for excellence and genuine care.</span>
            </div>
            <div style={{ border: `1px solid ${theme.border || `${theme.ink}18`}`, borderRadius: theme.radius, padding: 16 }}>
              <Heart size={18} color={theme.accent} />
              <strong style={{ display: "block", fontSize: 13.5, margin: "10px 0 6px" }}>Our Values</strong>
              <span style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>Excellence, integrity, hospitality, and community, in everything we do.</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="why-choose-us" style={{ padding: "70px 28px", background: theme.card }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>The difference</div>
        <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(28px, 4vw, 38px)", margin: "12px 0 40px" }}>Why Guests Choose Us</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24 }}>
          {[
            { icon: Gem, label: "Prime Location", sub: location || "Easy to find, easy to reach" },
            { icon: UserCheck, label: "Personalized Service", sub: "Tailored to your needs" },
            { icon: Building2, label: `World-Class ${niche.itemLabelPlural}`, sub: "Designed for your comfort" },
            { icon: ShieldCheck, label: "Safe & Secure", sub: "Your safety is our priority" },
            { icon: Leaf, label: "Sustainable Practices", sub: "A greener tomorrow" },
          ].map((f) => (
            <div key={f.label} style={{ textAlign: "center" }}>
              <f.icon size={26} color={theme.accent} style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{f.label}</div>
              <div style={{ fontSize: 11.5, color: muted, marginTop: 4 }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {(amenities.length || checkInOut.length) ? (
      <section style={{ padding: "20px 28px 80px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", border: `1px solid ${theme.border || `${theme.ink}18`}`, borderRadius: theme.radius, padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 50 }}>
          <div>
            <h3 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: "0 0 16px" }}>Property Essentials</h3>
            {amenities.map((a) => <div key={a} style={{ padding: "12px 0", borderBottom: `1px solid ${theme.border || `${theme.ink}18`}`, fontSize: 13, fontWeight: 700 }}>{a}</div>)}
          </div>
          {checkInOut.length > 0 && (
            <div>
              <h3 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: "0 0 16px" }}>Check-in & Check-out</h3>
              {checkInOut.map((a) => <div key={a} style={{ display: "flex", gap: 12, marginBottom: 14, fontSize: 13, color: muted }}><Clock3 size={16} color={theme.accent} style={{ flexShrink: 0 }} />{a}</div>)}
            </div>
          )}
        </div>
      </section>
    ) : null}

    {ctaBanner(theme, dark, heroImage, "Be a part of our story", "We Look Forward to Welcoming You", `Experience the perfect blend of comfort, service and genuine ${niche.rateUnit === "night" ? "hospitality" : "care"}.`, "Book Your Stay", `/store/${slug}/hotel/rooms`, [])}
  </>);


  if (section === "rooms") {
    const maxPrice = Math.max(0, ...roomItems.map((r) => r.price));
    const minPrice = roomItems.length ? Math.min(...roomItems.map((r) => r.price)) : 0;
    const listingItems: ListingItem[] = roomItems.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      price: room.price,
      currency: room.currency,
      image: room.image,
      categoryName: room.categoryName,
      attributes: room.attributes ?? null,
      badge: room.price === maxPrice && maxPrice > minPrice ? "Premium" : room.price === minPrice && roomItems.length > 2 ? "Most Popular" : null,
    }));
    return shell(<>
      {pageHero(theme, dark, heroImage, niche.sectionEyebrow, "Spaces made for staying well.", `Explore the collection and choose the ${niche.itemLabelSingular.toLowerCase()} that fits your ${niche.rateUnit === "night" ? "stay" : "booking"}.`)}
      {roomItems.length ? (
        <RoomsSuitesListing
          slug={slug}
          theme={theme}
          items={listingItems}
          itemLabelPlural={niche.itemLabelPlural}
          itemLabelSingular={niche.itemLabelSingular}
          rateUnit={niche.rateUnit}
          detailBasePath={`/store/${slug}/room`}
          bookBasePath={`/store/${slug}/room`}
          amenityFacets={niche.amenityFacets}
          supportPhone={store.contactPhone}
          featureStrip={{
            title: `A ${niche.rateUnit === "night" ? "Stay" : "Booking"} Tailored to You`,
            body: `Every ${niche.itemLabelSingular.toLowerCase()} is designed to give you the perfect blend of comfort and functionality.`,
            ctaLabel: `Explore ${niche.itemLabelPlural}`,
            ctaHref: `/store/${slug}/hotel/rooms`,
            features: niche.guarantees.map((g) => ({ icon: g.icon === "calendar" ? "clock" : "shield", label: g.label, sublabel: g.sublabel })),
          }}
        />
      ) : (
        <section style={{ padding: "70px 28px 130px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><p style={{ color: muted }}>Published {niche.itemLabelPlural.toLowerCase()} will appear here once they are added.</p></div></section>
      )}
    </>);
  }

  if (section === "experience") return shell(<>
    {pageHero(theme, dark, heroImage, "More than a stay", "Unforgettable Experiences", `Curated experiences designed to inspire, relax and create lasting memories at ${store.name}.`, "Stay. Experience. Belong.")}
    <section style={{ padding: "60px 28px 100px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 36 }}>
          <div>
            <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Our experiences</div>
            <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(28px, 4vw, 38px)", margin: "12px 0 10px" }}>Discover More at {store.name}</h2>
            <p style={{ color: muted, fontSize: 14, maxWidth: 560, margin: 0 }}>From world-class amenities to curated local experiences, discover what makes a stay here truly memorable.</p>
          </div>
          <Link href={`/store/${slug}/hotel/contact`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", border: `1px solid ${theme.accent}`, color: theme.accent, textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap" }}>Inquire About an Experience <ArrowUpRight size={14} /></Link>
        </div>
        <HotelExperienceGrid
          slug={slug}
          theme={theme}
          items={experiences.map((e) => ({ id: e.id, name: e.name, description: e.description, image: e.image, categoryName: e.categoryName }))}
          detailBasePath={`/store/${slug}/service`}
        />
      </div>
    </section>
    {ctaBanner(theme, dark, heroImage, "Experience it yourself", "Make Your Stay Extraordinary", "Let us help you curate the perfect experience.", "Contact Our Concierge", `/store/${slug}/hotel/contact`, [
      { icon: UserCheck, label: "Personalized Service" },
      { icon: Headphones, label: "24/7 Support" },
      { icon: Sparkles, label: "Memorable Experiences" },
    ])}
  </>);

  if (section === "gallery") return shell(<>
    {pageHero(theme, dark, heroImage, "Gallery", "Moments That Tell Our Story", `Explore the beauty, elegance and unique experiences that make ${store.name} a truly exceptional destination.`, "A Visual Journey Through Luxury.")}
    <section style={{ padding: "60px 28px 100px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 36 }}>
          <div>
            <div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Our gallery</div>
            <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(28px, 4vw, 38px)", margin: "12px 0 10px" }}>Explore Our World</h2>
            <p style={{ color: muted, fontSize: 14, maxWidth: 560, margin: 0 }}>From spaces and service to the details in between, our gallery gives you a glimpse of what awaits at {store.name}.</p>
          </div>
          <Link href={`/store/${slug}/hotel/contact`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", border: `1px solid ${theme.accent}`, color: theme.accent, textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap" }}>Plan a Visit <ArrowUpRight size={14} /></Link>
        </div>
        <HotelGalleryBrowser slug={slug} theme={theme} albums={galleryContent?.albums ?? []} fallbackImages={gallery} />
      </div>
    </section>
    {ctaBanner(theme, dark, heroImage, "Experience it yourself", "Create Your Own Memories", "Plan your stay and be part of our story.", "Book Your Stay", `/store/${slug}/hotel/rooms`, [
      { icon: Gem, label: `Luxury ${niche.rateUnit === "night" ? "Stay" : "Booking"}` },
      { icon: Heart, label: "Unforgettable Moments" },
      { icon: Camera, label: "Picture Perfect" },
      { icon: Users, label: "A Place for Everyone" },
    ])}
  </>);

  return shell(<>
    {pageHero(theme, dark, heroImage, "Reservations & concierge", "Let's plan your stay.", "For reservations, questions or special requests, contact the hotel directly.")}
    <section style={{ padding: "70px 28px 70px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><div className="bn-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 70, marginTop: 65 } as React.CSSProperties}><div style={{ background: dark, color: "#fff", padding: 40 }}><h2 style={{ fontFamily: theme.headlineFont, fontSize: 34, margin: 0 }}>Your stay starts here.</h2><p style={{ color: "rgba(255,255,255,.65)", lineHeight: 1.8, fontSize: 14 }}>Explore our rooms or reach the concierge team directly.</p><Link href={`/store/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#111", padding: "13px 17px", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12 }}>Explore rooms <ArrowUpRight size={14} /></Link></div><div style={{ display: "grid", gap: 22, alignContent: "center" }}>{location && <div style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14 }}><MapPin size={18} color={theme.accent} />{location}</div>}{store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ display: "flex", gap: 12, color: theme.ink, textDecoration: "none", fontSize: 14 }}><Phone size={18} color={theme.accent} />{store.contactPhone}</a>}{store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ display: "flex", gap: 12, color: theme.ink, textDecoration: "none", fontSize: 14 }}><Mail size={18} color={theme.accent} />{store.contactEmail}</a>}{avgRating != null && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>{Array.from({length:5}).map((_,i)=><Star key={i} size={14} color={theme.accent} fill={i < Math.round(avgRating) ? "currentColor" : "none"}/>)} {avgRating.toFixed(1)} guest rating</div>}</div></div></div></section>
  </>);
                                       }
                                   
