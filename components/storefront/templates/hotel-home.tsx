import Link from "next/link";
import type React from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Clock3, Mail, MapPin, Phone, Star } from "lucide-react";
import { Reveal } from "@/components/storefront/reveal";
import type { TemplateTheme } from "@/lib/template-themes";
import type { HospitalityGalleryContent } from "@/lib/actions/hospitality-content";

type CatalogItem = {
  id: string;
  kind: "product" | "service";
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image: string | null;
  categoryName: string | null;
  type: string;
  rentalUnit: string | null;
  isBookable: boolean;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  author?: { name?: string | null } | null;
};

type StoreLike = {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  storyImage?: string | null;
  template?: { previewUrl: string | null } | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: {
    description: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };
  onboardingProfile?: unknown;
};

type Props = {
  store: StoreLike;
  slug: string;
  catalogItems: CatalogItem[];
  goodReviews: Review[];
  avgRating: number | null;
  social: Record<string, string>;
  theme: TemplateTheme & { signatureMode?: string };
  galleryContent?: HospitalityGalleryContent | null;
};

type HotelProfile = {
  roomTypes: string[];
  checkInOut: string[];
  amenities: string[];
};

const ROOM_PATTERN = /room|suite|studio|apartment|villa|penthouse|chalet|cottage|lodge|duplex/i;

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,•|]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function hotelProfile(store: StoreLike): HotelProfile {
  const raw = store.onboardingProfile;
  const profile = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    roomTypes: listValue(profile.roomTypes),
    checkInOut: listValue(profile.checkInOut),
    amenities: listValue(profile.amenities),
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function itemHref(slug: string, item: CatalogItem) {
  return `/${slug}/${item.kind}/${item.id}`;
}

function imageStyle(url: string | null, fallback: string): React.CSSProperties {
  return url
    ? { backgroundImage: `url(${url})`, backgroundPosition: "center", backgroundSize: "cover" }
    : { background: fallback };
}

export function HotelStorefront({ store, slug, catalogItems, goodReviews, avgRating, social, theme, galleryContent }: Props) {
  const profile = hotelProfile(store);
  const rooms = catalogItems.filter((item) => ROOM_PATTERN.test(`${item.name} ${item.categoryName ?? ""}`)).slice(0, 6);
  const roomItems = rooms.length ? rooms : catalogItems.slice(0, 6);
  const experiences = catalogItems.filter((item) => item.kind === "service").slice(0, 6);
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const storyImage = store.storyImage || roomItems.find((item) => item.image)?.image || heroImage;
  const managedGalleryImages = galleryContent?.albums.flatMap((album) => album.images.map((image) => image.image)).filter(Boolean) ?? [];
  const galleryImages = Array.from(new Set([...managedGalleryImages, heroImage, ...roomItems.map((item) => item.image)].filter(Boolean) as string[])).slice(0, 8);
  const location = [store.business.city, store.business.state, store.business.country].filter(Boolean).join(", ");
  const primary = theme.accent;
  const ink = theme.ink;
  const muted = theme.muted || `${ink}99`;
  const dark = theme.surfaceDark || "#171411";

  const sectionTitle = (eyebrow: string, title: string, body?: string) => (
    <div style={{ maxWidth: 760 }}>
      <div style={{ color: primary, fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>{eyebrow}</div>
      <h2 style={{ margin: "12px 0 0", fontFamily: theme.headlineFont, fontSize: "clamp(34px, 5vw, 64px)", lineHeight: 0.98, letterSpacing: "-0.045em", fontWeight: 650 }}>{title}</h2>
      {body && <p style={{ color: muted, fontSize: 15, lineHeight: 1.85, maxWidth: 650, margin: "18px 0 0" }}>{body}</p>}
    </div>
  );

  return (
    <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, overflow: "hidden" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: `${theme.bg}F2`, backdropFilter: "blur(18px)", borderBottom: `1px solid ${theme.border || `${ink}18`}` }}>
        <div className="bn-header-inner" style={{ maxWidth: 1320, margin: "0 auto", minHeight: 76, padding: "0 28px", display: "flex", alignItems: "center", gap: 28 }}>
          <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} style={{ width: 40, height: 40, objectFit: "contain" }} />
            ) : (
              <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", background: ink, color: theme.bg, fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>{initials(store.name)}</span>
            )}
            <span style={{ fontFamily: theme.headlineFont, fontSize: 17, fontWeight: 700, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{store.name}</span>
          </Link>

          <input type="checkbox" id={`bn-nav-${slug}-hotel`} className="bn-nav-toggle" />
          <label htmlFor={`bn-nav-${slug}-hotel`} className="bn-hamburger" style={{ color: ink, marginLeft: "auto" }} aria-label="Menu">☰</label>

          <nav className="bn-nav-links" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 25, fontSize: 12, fontWeight: 650 }}>
            <a href={`/${slug}/hotel/story`} style={{ color: ink, textDecoration: "none" }}>The Hotel</a>
            <a href={`/${slug}/hotel/rooms`} style={{ color: ink, textDecoration: "none" }}>Rooms</a>
            {experiences.length > 0 && <a href={`/${slug}/hotel/experience`} style={{ color: ink, textDecoration: "none" }}>Experience</a>}
            {galleryImages.length > 1 && <a href={`/${slug}/hotel/gallery`} style={{ color: ink, textDecoration: "none" }}>Gallery</a>}
            <a href={`/${slug}/hotel/contact`} style={{ color: ink, textDecoration: "none" }}>Contact</a>
            <a href={`/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", background: ink, color: theme.bg, textDecoration: "none", borderRadius: theme.radius, fontWeight: 800 }}>Reserve <ArrowUpRight size={14} /></a>
          </nav>
        </div>
      </header>

      <main>
        <section style={{ position: "relative", minHeight: "min(820px, 88vh)", display: "flex", alignItems: "flex-end", color: "#fff", background: heroImage ? `linear-gradient(180deg, rgba(8,7,6,.16) 0%, rgba(8,7,6,.28) 40%, rgba(8,7,6,.84) 100%), url(${heroImage}) center/cover` : `linear-gradient(135deg, ${dark}, ${theme.accent})` }}>
          <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto", padding: "110px 28px 72px" }}>
            <Reveal>
              <div style={{ maxWidth: 840 }}>
                <p style={{ margin: 0, color: theme.accentSoft || primary, fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase" }}>{theme.eyebrow || "Hospitality, thoughtfully considered"}</p>
                <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(52px, 9vw, 116px)", lineHeight: .88, letterSpacing: "-0.065em", fontWeight: 650, margin: "18px 0 24px", maxWidth: 900 }}>{store.name}</h1>
                <p style={{ maxWidth: 650, margin: 0, color: "rgba(255,255,255,.78)", fontSize: 17, lineHeight: 1.8 }}>{store.business.description || theme.sub}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
                  <a href={`/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 19px", background: "#fff", color: "#111", textDecoration: "none", borderRadius: theme.radius, fontSize: 13, fontWeight: 800 }}>Discover the stay <ArrowDownRight size={15} /></a>
                  <a href={`/${slug}/hotel/contact`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 19px", border: "1px solid rgba(255,255,255,.38)", color: "#fff", textDecoration: "none", borderRadius: theme.radius, fontSize: 13, fontWeight: 750 }}>Contact concierge</a>
                </div>
              </div>
            </Reveal>
          </div>
          <div style={{ position: "absolute", right: 28, bottom: 32, display: "flex", alignItems: "center", gap: 9, color: "rgba(255,255,255,.75)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>
            <span style={{ width: 34, height: 1, background: "rgba(255,255,255,.5)" }} /> Scroll to explore
          </div>
        </section>

        <section id="story" style={{ padding: "120px 28px" }}>
          <div className="bn-2col" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, .9fr) minmax(0, 1.1fr)", gap: 80, alignItems: "center", "--bn-cols": ".9fr 1.1fr" } as React.CSSProperties}>
            <Reveal>
              {sectionTitle("The property", "A place with a point of view.", store.business.description || theme.sub)}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 36 }}>
                {avgRating != null && <div><strong style={{ display: "block", fontFamily: theme.headlineFont, fontSize: 30 }}>{avgRating.toFixed(1)}</strong><span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>Guest rating</span></div>}
                {roomItems.length > 0 && <div><strong style={{ display: "block", fontFamily: theme.headlineFont, fontSize: 30 }}>{roomItems.length}</strong><span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>Accommodation types</span></div>}
                {location && <div><strong style={{ display: "block", fontFamily: theme.headlineFont, fontSize: 16, marginTop: 7 }}>{location}</strong><span style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>Location</span></div>}
              </div>
            </Reveal>
            {storyImage && <Reveal><div style={{ minHeight: 560, ...imageStyle(storyImage, `linear-gradient(135deg, ${theme.accentSoft || primary}, ${dark})`) }} /></Reveal>}
          </div>
        </section>

        <section id="rooms" style={{ padding: "105px 28px", background: dark, color: "#fff" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <Reveal>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "end", flexWrap: "wrap", marginBottom: 42 }}>
                {sectionTitle("Accommodations", "Spaces made for staying.", "Explore the rooms and suites available at this property. Each accommodation is presented as part of the hotel's story — not as a product listing.")}
                <a href={`/${slug}/hotel/rooms`} style={{ color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, borderBottom: `1px solid ${theme.accent}`, paddingBottom: 6 }}>View all rooms <ArrowUpRight size={14} style={{ verticalAlign: "middle", marginLeft: 5 }} /></a>
              </div>
            </Reveal>

            {roomItems.length > 0 ? (
              <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                {roomItems.map((room, index) => (
                  <Reveal key={`${room.kind}-${room.id}`}>
                    <Link href={itemHref(slug, room)} style={{ color: "#fff", textDecoration: "none", display: "block" }}>
                      <div style={{ position: "relative", aspectRatio: index === 0 ? "1.15/1" : "1/1.08", overflow: "hidden", ...imageStyle(room.image, `linear-gradient(${135 + index * 7}deg, ${theme.accentSoft || primary}, #25201c)`) }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,.76))" }} />
                        <div style={{ position: "absolute", left: 20, right: 20, bottom: 18 }}>
                          <span style={{ display: "block", color: theme.accentSoft || primary, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 7 }}>{room.categoryName || "Accommodation"}</span>
                          <h3 style={{ margin: 0, fontFamily: theme.headlineFont, fontSize: 25, letterSpacing: "-.025em" }}>{room.name}</h3>
                          {room.description && <p style={{ margin: "7px 0 0", color: "rgba(255,255,255,.68)", fontSize: 12, lineHeight: 1.6 }}>{room.description}</p>}
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div style={{ border: "1px dashed rgba(255,255,255,.25)", padding: 30, color: "rgba(255,255,255,.65)" }}>Published accommodations will appear here once they are added to the hotel.</div>
            )}
          </div>
        </section>

        {(profile.amenities.length > 0 || profile.checkInOut.length > 0) && (
          <section style={{ padding: "105px 28px", background: theme.card }}>
            <div className="bn-2col" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, "--bn-cols": "1fr 1fr" } as React.CSSProperties}>
              <Reveal>
                {sectionTitle("The essentials", "Comfort without the clutter.")}
                {profile.amenities.length > 0 && (
                  <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: `1px solid ${theme.border || `${ink}18`}` }}>
                    {profile.amenities.map((amenity) => <div key={amenity} style={{ padding: "16px 0", borderBottom: `1px solid ${theme.border || `${ink}18`}`, fontSize: 13, fontWeight: 700 }}>{amenity}</div>)}
                  </div>
                )}
              </Reveal>
              {profile.checkInOut.length > 0 && (
                <Reveal>
                  <div style={{ padding: 34, background: theme.bg, border: `1px solid ${theme.border || `${ink}18`}` }}>
                    <div style={{ color: primary, fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>Guest information</div>
                    <h3 style={{ fontFamily: theme.headlineFont, fontSize: 32, lineHeight: 1.05, margin: "13px 0 26px" }}>Arrive well. Leave restored.</h3>
                    <div style={{ display: "grid", gap: 16 }}>
                      {profile.checkInOut.map((entry) => <div key={entry} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><Clock3 size={17} color={primary} /><span style={{ fontSize: 13, lineHeight: 1.6 }}>{entry}</span></div>)}
                    </div>
                  </div>
                </Reveal>
              )}
            </div>
          </section>
        )}

        {experiences.length > 0 && (
          <section id="experience" style={{ padding: "105px 28px" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto" }}>
              <Reveal>{sectionTitle("Beyond the room", "The stay is more than a bed.", "Present hotel services, experiences and bookable moments as part of the property — with no product-card pricing taking over the page.")}</Reveal>
              <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 46 }}>
                {experiences.map((service, index) => (
                  <Reveal key={`${service.kind}-${service.id}`}>
                    <Link href={itemHref(slug, service)} style={{ textDecoration: "none", color: ink, display: "block", borderTop: `1px solid ${theme.border || `${ink}18`}`, paddingTop: 20 }}>
                      {service.image && <div style={{ aspectRatio: "16/10", marginBottom: 18, ...imageStyle(service.image, `${primary}16`) }} />}
                      <span style={{ color: primary, fontSize: 10, fontWeight: 800, letterSpacing: ".16em" }}>0{index + 1}</span>
                      <h3 style={{ fontFamily: theme.headlineFont, fontSize: 24, margin: "10px 0 8px" }}>{service.name}</h3>
                      <p style={{ color: muted, fontSize: 13, lineHeight: 1.75, margin: 0 }}>{service.description || "Discover more about this experience."}</p>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 18, fontSize: 12, fontWeight: 800 }}>Discover <ArrowUpRight size={13} /></span>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {galleryImages.length > 1 && (
          <section id="gallery" style={{ padding: "105px 28px", background: theme.card }}>
            <div style={{ maxWidth: 1240, margin: "0 auto" }}>
              <Reveal>{sectionTitle("Visual narrative", "See the place before you arrive.")}</Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "1.45fr .8fr .8fr", gridAutoRows: 240, gap: 12, marginTop: 42 }}>
                {galleryImages.map((image, index) => <Reveal key={image}><div style={{ height: "100%", gridRow: index === 0 ? "span 2" : undefined, ...imageStyle(image, `${primary}16`) }} /></Reveal>)}
              </div>
            </div>
          </section>
        )}

        {goodReviews.length > 0 && (
          <section style={{ padding: "105px 28px" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto" }}>
              <Reveal>{sectionTitle("Guest perspective", "A stay is remembered by how it felt.")}</Reveal>
              <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 42 }}>
                {goodReviews.slice(0, 3).map((review) => (
                  <Reveal key={review.id}>
                    <figure style={{ margin: 0, padding: 26, background: theme.card, border: `1px solid ${theme.border || `${ink}18`}` }}>
                      <div style={{ display: "flex", gap: 3, color: primary }} aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />)}</div>
                      <blockquote style={{ margin: "22px 0", fontFamily: theme.headlineFont, fontSize: 21, lineHeight: 1.3, letterSpacing: "-.02em" }}>{review.comment}</blockquote>
                      <figcaption style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>{review.author?.name || "Verified guest"}</figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="contact" style={{ padding: "110px 28px", background: dark, color: "#fff" }}>
          <div className="bn-2col" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 80, "--bn-cols": "1.25fr .75fr" } as React.CSSProperties}>
            <Reveal>
              <div style={{ color: theme.accentSoft || primary, fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Reservations & concierge</div>
              <h2 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(40px, 6vw, 72px)", lineHeight: .96, letterSpacing: "-.05em", margin: "15px 0 24px" }}>Make your next stay part of the story.</h2>
              <a href={`/${slug}/hotel/rooms`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 19px", background: "#fff", color: "#111", borderRadius: theme.radius, textDecoration: "none", fontWeight: 800, fontSize: 13 }}>Explore rooms <ArrowUpRight size={15} /></a>
            </Reveal>
            <Reveal>
              <div style={{ display: "grid", gap: 18, paddingTop: 5 }}>
                {location && <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><MapPin size={17} color={theme.accentSoft || primary} /><span style={{ fontSize: 14, lineHeight: 1.7 }}>{location}</span></div>}
                {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ display: "flex", gap: 12, alignItems: "center", color: "#fff", textDecoration: "none", fontSize: 14 }}><Phone size={17} color={theme.accentSoft || primary} />{store.contactPhone}</a>}
                {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ display: "flex", gap: 12, alignItems: "center", color: "#fff", textDecoration: "none", fontSize: 14 }}><Mail size={17} color={theme.accentSoft || primary} />{store.contactEmail}</a>}
                {Object.entries(social).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>{Object.entries(social).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,.75)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>{name}</a>)}</div>}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer style={{ padding: "26px 28px", background: dark, color: "rgba(255,255,255,.58)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div className="bn-2col" style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto", gap: 30, "--bn-cols": "1fr auto" } as React.CSSProperties}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}><CalendarDays size={14} /> {profile.checkInOut[0] || "Reservations available"}</div>
          <div style={{ fontSize: 11 }}>© {new Date().getFullYear()} {store.name}</div>
        </div>
      </footer>
    </div>
  );
}
