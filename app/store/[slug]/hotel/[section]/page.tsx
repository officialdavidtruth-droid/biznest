import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3, Mail, MapPin, Phone, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, getSignatureTheme, isSignatureTemplate, type TemplateTheme } from "@/lib/template-themes";
import { getHospitalityGallery } from "@/lib/actions/hospitality-content";
import { formatMoney } from "@/lib/storefront/hero-media";
import { AccountLink } from "@/components/storefront/account-link";

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
};

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\n,•|]+/).map((v) => v.trim()).filter(Boolean);
}

function pageHero(theme: TemplateTheme, dark: string, heroImage: string | null, eyebrow: string, title: string, body?: string) {
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
      <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <div style={{ color: theme.accentSoft || theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>{eyebrow}</div>
        <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(40px, 6vw, 76px)", lineHeight: .96, letterSpacing: "-.05em", margin: "14px 0 0", fontWeight: 650 }}>{title}</h1>
        {body && <p style={{ color: "rgba(255,255,255,.78)", fontSize: 15, lineHeight: 1.8, maxWidth: 620, margin: "18px 0 0" }}>{body}</p>}
      </div>
    </section>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
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

function HotelHeader({ store, slug, theme, active }: { store: any; slug: string; theme: TemplateTheme; active: Section }) {
  const nav = [
    ["story", "The Hotel"], ["rooms", "Rooms"], ["experience", "Experience"], ["gallery", "Gallery"], ["contact", "Contact"],
  ] as const;
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: `${theme.bg}F2`, backdropFilter: "blur(18px)", borderBottom: `1px solid ${theme.border || `${theme.ink}18`}` }}>
      <div className="bn-header-inner" style={{ maxWidth: 1320, margin: "0 auto", minHeight: 76, padding: "0 28px", display: "flex", alignItems: "center", gap: 28 }}>
        <Link href={`/store/${slug}`} style={{ color: theme.ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ width: 40, height: 40, objectFit: "contain" }} /> : <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", background: theme.ink, color: theme.bg, fontSize: 12, fontWeight: 800 }}>{initials(store.name)}</span>}
          <span style={{ fontFamily: theme.headlineFont, fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{store.name}</span>
        </Link>
        <input type="checkbox" id={`bn-nav-${slug}-hotel-page`} className="bn-nav-toggle" />
        <label htmlFor={`bn-nav-${slug}-hotel-page`} className="bn-hamburger" style={{ color: theme.ink, marginLeft: "auto" }} aria-label="Menu">☰</label>
        <nav className="bn-nav-links" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 25, fontSize: 12, fontWeight: 650 }}>
          {nav.map(([key, label]) => <Link key={key} href={`/store/${slug}/hotel/${key}`} aria-current={active === key ? "page" : undefined} style={{ color: theme.ink, textDecoration: "none", opacity: active === key ? 1 : .68, borderBottom: active === key ? `1px solid ${theme.accent}` : "1px solid transparent", paddingBottom: 4 }}>{label}</Link>)}
          <AccountLink storeSlug={slug} ink={theme.ink} />
          <Link href={`/store/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", background: theme.ink, color: theme.bg, textDecoration: "none", borderRadius: theme.radius, fontWeight: 800 }}>Reserve <ArrowUpRight size={14} /></Link>
        </nav>
      </div>
    </header>
  );
}

function HotelFooter({ store, slug, theme }: { store: any; slug: string; theme: TemplateTheme }) {
  return (
    <footer style={{ padding: "30px 28px", background: theme.surfaceDark || "#171411", color: "rgba(255,255,255,.62)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", fontSize: 11 }}>
        <Link href={`/store/${slug}`} style={{ color: "rgba(255,255,255,.75)", textDecoration: "none" }}>© {new Date().getFullYear()} {store.name}</Link>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href={`/store/${slug}/hotel/story`} style={{ color: "inherit", textDecoration: "none" }}>The Hotel</Link>
          <Link href={`/store/${slug}/hotel/rooms`} style={{ color: "inherit", textDecoration: "none" }}>Rooms</Link>
          <Link href={`/store/${slug}/hotel/contact`} style={{ color: "inherit", textDecoration: "none" }}>Contact</Link>
        </div>
      </div>
    </footer>
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
    ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, isBookable: s.isBookable })),
  ];
  const rooms = items.filter((i) => ROOM_PATTERN.test(`${i.name} ${i.categoryName ?? ""}`));
  const roomItems = rooms.length ? rooms : items.filter((i) => i.kind === "product");
  const experiences = items.filter((i) => i.kind === "service");
  const galleryContent = section === "gallery" ? await getHospitalityGallery(slug) : null;
  const gallery = galleryContent?.albums.flatMap((album) => album.images.map((image) => image.image)).filter(Boolean) ?? Array.from(new Set([store.bannerUrl, store.storyImage, ...items.map((i) => i.image)].filter(Boolean) as string[])).slice(0, 12);
  const location = [store.business.city, store.business.state, store.business.country].filter(Boolean).join(", ");
  const avgRating = store.reviews.length ? store.reviews.reduce((sum, r) => sum + r.rating, 0) / store.reviews.length : null;
  const muted = theme.muted || `${theme.ink}99`;
  const dark = theme.surfaceDark || "#171411";
  const heroImage = store.bannerUrl || store.storyImage || roomItems.find((i) => i.image)?.image || gallery[0] || null;

  const shell = (content: React.ReactNode) => <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font, minHeight: "100vh" }}><HotelHeader store={store} slug={slug} theme={theme} active={section as Section} /><main>{content}</main><HotelFooter store={store} slug={slug} theme={theme} /></div>;

  if (section === "story") return shell(<>
    {pageHero(theme, dark, heroImage, "The property", "A place with a point of view.", store.business.description || theme.sub)}
    <section style={{ padding: "0 28px 120px" }}><div className="bn-2col" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 70, alignItems: "center" } as React.CSSProperties}><div style={{ aspectRatio: "4/3", background: store.storyImage || store.bannerUrl ? `url(${store.storyImage || store.bannerUrl}) center/cover` : `linear-gradient(135deg, ${dark}, ${theme.accent})` }} /><div><div style={{ color: theme.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Hospitality, thoughtfully considered</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(34px, 5vw, 62px)", lineHeight: 1, letterSpacing: "-.045em", margin: "14px 0 22px" }}>Designed for the way you want to stay.</h2><p style={{ color: muted, lineHeight: 1.9, fontSize: 15 }}>{store.business.description || "A considered stay shaped by comfort, service and a sense of place."}</p>{location && <div style={{ display: "flex", gap: 10, marginTop: 28, fontSize: 13 }}><MapPin size={17} color={theme.accent} />{location}</div>}</div></div></section>
    {(amenities.length || checkInOut.length) ? <section style={{ padding: "100px 28px", background: theme.card }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><h2 style={{ fontFamily: theme.headlineFont, fontSize: 48, margin: 0 }}>The essentials.</h2><div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, marginTop: 40 }}><div>{amenities.map(a => <div key={a} style={{ padding: "16px 0", borderBottom: `1px solid ${theme.border || `${theme.ink}18`}`, fontSize: 13, fontWeight: 700 }}>{a}</div>)}</div><div>{checkInOut.map(a => <div key={a} style={{ display: "flex", gap: 12, marginBottom: 18, fontSize: 13 }}><Clock3 size={17} color={theme.accent} />{a}</div>)}</div></div></div></section> : null}
  </>);

  if (section === "rooms") return shell(<>
    {pageHero(theme, dark, heroImage, "Rooms & suites", "Spaces made for staying well.", "Explore the accommodation collection and choose the room that fits your stay.")}
    <section style={{ padding: "70px 28px 130px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 28 }}>{roomItems.length ? roomItems.map((room) => <Link key={room.id} href={`/store/${slug}/room/${room.id}`} className="bn-room-card" style={{ color: theme.ink, textDecoration: "none", display: "flex", border: `1px solid ${theme.border || `${theme.ink}18`}`, background: theme.card, overflow: "hidden" }}><div className="bn-room-card-img" style={{ width: "42%", flexShrink: 0, aspectRatio: "4/3", background: room.image ? `url(${room.image}) center/cover` : `linear-gradient(135deg, ${theme.accent}, ${dark})` }} /><div style={{ flex: 1, padding: "30px 34px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span style={{ color: theme.accent, fontSize: 10, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>{room.categoryName || "Accommodation"}</span>{room.price > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: theme.accent, whiteSpace: "nowrap" }}>{formatMoney(room.price, room.currency)} <span style={{ opacity: .6, fontWeight: 600 }}>/ night</span></span>}</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: 30, margin: 0, letterSpacing: "-.02em" }}>{room.name}</h2><p style={{ margin: 0, color: muted, lineHeight: 1.75, fontSize: 13.5, maxWidth: 480 }}>{room.description || "Discover this accommodation."}</p><div style={{ height: 1, background: theme.border || `${theme.ink}14`, margin: "6px 0 2px", maxWidth: 480 }} /><span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: theme.ink }}>View room <ArrowUpRight size={13} /></span></div></Link>) : <p style={{ color: muted }}>Published rooms will appear here once they are added.</p>}</div></div></section>
  </>);

  if (section === "experience") return shell(<>
    {pageHero(theme, dark, heroImage, "The experience", "More than a room.", "Discover the services, experiences and moments that shape the stay.")}
    <section style={{ padding: "70px 28px 130px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>{experiences.length ? experiences.map((service, i) => <Link key={service.id} href={`/store/${slug}/service/${service.id}`} style={{ color: theme.ink, textDecoration: "none", borderTop: `1px solid ${theme.border || `${theme.ink}18`}`, paddingTop: 20 }}><div style={{ aspectRatio: "16/10", background: service.image ? `url(${service.image}) center/cover` : `${theme.accent}18`, marginBottom: 20 }} /><span style={{ color: theme.accent, fontSize: 10, fontWeight: 800, letterSpacing: ".16em" }}>0{i + 1}</span><h2 style={{ fontFamily: theme.headlineFont, fontSize: 25, margin: "10px 0 8px" }}>{service.name}</h2><p style={{ color: muted, lineHeight: 1.75, fontSize: 13 }}>{service.description || "Discover more about this experience."}</p></Link>) : <p style={{ color: muted }}>Published experiences will appear here once they are added.</p>}</div></div></section>
  </>);

  if (section === "gallery") return shell(<>
    {pageHero(theme, dark, heroImage, galleryContent?.eyebrow || "Visual narrative", galleryContent?.title || "See the place before you arrive.", galleryContent?.intro)}
    <section style={{ padding: "70px 28px 130px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}>{galleryContent?.albums.length ? <div style={{ display: "grid", gap: 90, marginTop: 58 }}>{galleryContent.albums.map((album) => <section key={album.id}><div style={{ maxWidth: 760, marginBottom: 28 }}><h2 style={{ fontFamily: theme.headlineFont, fontSize: 36, margin: 0 }}>{album.title}</h2>{album.description && <p style={{ color: muted, lineHeight: 1.8, fontSize: 14, marginTop: 10 }}>{album.description}</p>}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>{album.images.map((image, i) => <article key={image.id} className="bn-room-card" style={{ gridColumn: i === 0 ? "1 / -1" : undefined, display: "flex", border: `1px solid ${theme.border || `${theme.ink}18`}`, background: theme.card, overflow: "hidden" }}><div className="bn-room-card-img" style={{ width: "42%", flexShrink: 0, aspectRatio: "4/3", overflow: "hidden" }}><img src={image.image} alt={image.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>{(image.title || image.caption) && <div style={{ flex: 1, padding: "24px 26px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, minWidth: 0 }}><strong style={{ fontFamily: theme.headlineFont, fontSize: 19, color: theme.ink }}>{image.title}</strong>{image.caption && <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>{image.caption}</div>}</div>}</article>)}</div></section>)}</div> : <div style={{ display: "grid", gridTemplateColumns: "1.4fr .8fr .8fr", gridAutoRows: 260, gap: 12, marginTop: 55 }}>{gallery.length ? gallery.map((image, i) => <div key={image} style={{ gridRow: i === 0 ? "span 2" : undefined, background: `url(${image}) center/cover` }} />) : <p style={{ color: muted }}>Gallery images will appear here once they are added.</p>}</div>}</div></section>
  </>);

  return shell(<>
    {pageHero(theme, dark, heroImage, "Reservations & concierge", "Let's plan your stay.", "For reservations, questions or special requests, contact the hotel directly.")}
    <section style={{ padding: "70px 28px 70px" }}><div style={{ maxWidth: 1240, margin: "0 auto" }}><div className="bn-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 70, marginTop: 65 } as React.CSSProperties}><div style={{ background: dark, color: "#fff", padding: 40 }}><h2 style={{ fontFamily: theme.headlineFont, fontSize: 34, margin: 0 }}>Your stay starts here.</h2><p style={{ color: "rgba(255,255,255,.65)", lineHeight: 1.8, fontSize: 14 }}>Explore our rooms or reach the concierge team directly.</p><Link href={`/store/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#111", padding: "13px 17px", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12 }}>Explore rooms <ArrowUpRight size={14} /></Link></div><div style={{ display: "grid", gap: 22, alignContent: "center" }}>{location && <div style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14 }}><MapPin size={18} color={theme.accent} />{location}</div>}{store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ display: "flex", gap: 12, color: theme.ink, textDecoration: "none", fontSize: 14 }}><Phone size={18} color={theme.accent} />{store.contactPhone}</a>}{store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ display: "flex", gap: 12, color: theme.ink, textDecoration: "none", fontSize: 14 }}><Mail size={18} color={theme.accent} />{store.contactEmail}</a>}{avgRating != null && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>{Array.from({length:5}).map((_,i)=><Star key={i} size={14} color={theme.accent} fill={i < Math.round(avgRating) ? "currentColor" : "none"}/>)} {avgRating.toFixed(1)} guest rating</div>}</div></div></div></section>
  </>);
                                       }
                                   
