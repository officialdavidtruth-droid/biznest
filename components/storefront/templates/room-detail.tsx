"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  Wifi, Wind, Tv, Wine, ConciergeBell, Building2, Bed, Briefcase, Maximize2, Lock,
  Bath, Sparkles, Home as HomeIcon, Clock3, Ban, Star, Heart, Calendar, Users,
  ChevronLeft, ChevronRight, Search, Facebook, Instagram, Twitter, Youtube, Linkedin,
  MapPin, Phone, Mail, ShieldCheck, BadgeCheck, Headphones, ArrowRight, Crown,
} from "lucide-react";
import { formatMoney } from "@/lib/storefront/hero-media";
import { toggleStoreWishlist } from "@/lib/actions/account";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import type { Guarantee } from "@/lib/storefront/unit-booking-niche";
import { toast } from "sonner";

type Theme = {
  bg: string; ink: string; card: string; accent: string;
  border?: string; muted?: string; radius: string; font: string; headlineFont: string; surfaceDark?: string;
};

type ReviewItem = { id: string; name: string; avatarUrl?: string | null; date: string; rating: number; text: string };
type FactItem = { icon: "guests" | "bed" | "size" | "view"; label: string };
type FacetItem = { key: string; label: string };
type FeatureItem = { label: string; value: string };

type Props = {
  slug: string;
  theme: Theme;
  store: { name: string; logoUrl?: string | null; contactPhone?: string | null; contactEmail?: string | null; address?: string | null };
  roomId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  images: string[];
  badge?: string | null;
  breadcrumbLabel: string;
  quickFacts: FactItem[];
  heroQuote?: string;
  amenityStrip: FacetItem[];
  featureGrid: FeatureItem[];
  overviewParagraphs: string[];
  policies?: { checkIn: string[]; checkOut: string[] } | null;
  reviews: ReviewItem[];
  avgRating: number | null;
  reviewCount: number;
  rateUnit: string;
  itemLabelSingular: string;
  itemLabelPlural: string;
  guarantees: Guarantee[];
  addonsPromo?: { title: string; body: string; ctaLabel: string; ctaHref: string; image?: string | null } | null;
  bookBasePath: string;
  defaultGuests?: number;
  isBookable: boolean;
};

const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, ac: Wind, tv: Tv, minibar: Wine, roomService: ConciergeBell, view: Building2,
  breakfast: ConciergeBell, pool: Building2, bathtub: Bath, workDesk: Briefcase, kitchenette: HomeIcon, smoking: Ban,
};

function AmenityIcon({ facetKey, size, color }: { facetKey: string; size: number; color: string }) {
  const Icon = AMENITY_ICONS[facetKey] || Sparkles;
  return <Icon size={size} color={color} />;
}

function FactIcon({ icon, size, color }: { icon: FactItem["icon"]; size: number; color: string }) {
  if (icon === "bed") return <Bed size={size} color={color} />;
  if (icon === "size") return <Maximize2 size={size} color={color} />;
  if (icon === "view") return <Building2 size={size} color={color} />;
  return <Users size={size} color={color} />;
}

function GuaranteeIcon({ icon, size, color }: { icon: Guarantee["icon"]; size: number; color: string }) {
  if (icon === "calendar") return <Clock3 size={size} color={color} />;
  if (icon === "badge") return <BadgeCheck size={size} color={color} />;
  if (icon === "support") return <Headphones size={size} color={color} />;
  return <ShieldCheck size={size} color={color} />;
}

const TABS = ["Overview", "Amenities", "Room Policies", "Reviews", "Location"] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function RoomDetail(props: Props) {
  const {
    slug, theme, store, roomId, name, description, price, currency, images, badge,
    breadcrumbLabel, quickFacts, heroQuote, amenityStrip, featureGrid, overviewParagraphs,
    policies, reviews, avgRating, reviewCount, rateUnit, itemLabelSingular, itemLabelPlural,
    guarantees, addonsPromo, bookBasePath, defaultGuests = 2, isBookable,
  } = props;

  const { requireSignedIn } = useShopAuthGate(slug);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(defaultGuests);
  const [wishlisted, setWishlisted] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);

  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;
  const dark = theme.surfaceDark || "#171411";

  const gallery = images.length ? images : [null];
  const thumbs = gallery.slice(1, 5);
  const extraCount = Math.max(0, gallery.length - 5);

  function bookHref() {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", String(guests));
    const qs = params.toString();
    return `${bookBasePath}${qs ? `?${qs}` : ""}`;
  }

  function toggleWishlist() {
    if (!requireSignedIn(`save this ${itemLabelSingular.toLowerCase()}`)) return;
    setWishlisted((prev) => !prev);
    toggleStoreWishlist(slug, { serviceId: roomId }).then((result) => {
      if (!result.success) {
        setWishlisted((prev) => !prev);
        toast.error(result.error);
        return;
      }
      setWishlisted(result.data.wishlisted);
    });
  }

  const galleryVisible = 5;
  const galleryPhotos = gallery.filter(Boolean) as string[];
  const galleryPage = galleryPhotos.slice(galleryStart, galleryStart + galleryVisible);

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: theme.bg, minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: `${theme.bg}F5`, backdropFilter: "blur(18px)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", minHeight: 72, padding: "0 28px", display: "flex", alignItems: "center", gap: 28 }}>
          <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ width: 38, height: 38, objectFit: "contain" }} /> : <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", background: ink, color: theme.bg, fontSize: 12, fontWeight: 800, borderRadius: 8 }}>{initials(store.name)}</span>}
            <span style={{ fontFamily: theme.headlineFont, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{store.name}</span>
          </Link>
          <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 24, fontSize: 12.5, fontWeight: 650 }}>
            <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none", opacity: 0.75 }}>Home</Link>
            <Link href={`/store/${slug}/hotel/rooms`} style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, paddingBottom: 4 }}>{itemLabelPlural}</Link>
            <Link href={`/store/${slug}/hotel/experience`} style={{ color: ink, textDecoration: "none", opacity: 0.75 }}>Amenities</Link>
            <Link href={`/store/${slug}/hotel/gallery`} style={{ color: ink, textDecoration: "none", opacity: 0.75 }}>Gallery</Link>
            <Link href={`/store/${slug}/hotel/story`} style={{ color: ink, textDecoration: "none", opacity: 0.75 }}>About</Link>
            <Link href={`/store/${slug}/hotel/contact`} style={{ color: ink, textDecoration: "none", opacity: 0.75 }}>Contact</Link>
            <Link href={`/store/${slug}/search`} aria-label="Search" style={{ color: ink, display: "flex" }}><Search size={16} /></Link>
            <Link href={`/store/${slug}/hotel/rooms`} style={{ padding: "10px 18px", background: accent, color: "#fff", textDecoration: "none", borderRadius: theme.radius, fontWeight: 800, fontSize: 12 }}>Book Now</Link>
          </nav>
        </div>
      </header>

      {/* Breadcrumb hero */}
      <section style={{ position: "relative", minHeight: 210, display: "flex", alignItems: "flex-end", color: "#fff", padding: "36px 28px 26px", background: gallery[0] ? `linear-gradient(180deg, rgba(8,7,6,.35) 0%, rgba(8,7,6,.5) 55%, rgba(8,7,6,.92) 100%), url(${gallery[0]}) center/cover` : `linear-gradient(135deg, ${dark}, ${accent})` }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <Link href={`/store/${slug}`} style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
            <span>›</span>
            <Link href={`/store/${slug}/hotel/rooms`} style={{ color: "inherit", textDecoration: "none" }}>{breadcrumbLabel}</Link>
            <span>›</span>
            <span style={{ color: "#fff" }}>{name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 640 }}>
              <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(30px, 4.4vw, 46px)", margin: 0, lineHeight: 1.05, fontWeight: 650 }}>{name}</h1>
              {description && <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(255,255,255,.82)" }}>{description}</p>}
              {quickFacts.length > 0 && (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16, fontSize: 12.5 }}>
                  {quickFacts.map((f) => (
                    <span key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.9)" }}>
                      <FactIcon icon={f.icon} size={14} color="rgba(255,255,255,.85)" />{f.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {heroQuote && (
              <div style={{ maxWidth: 220, textAlign: "right" }}>
                <span style={{ fontFamily: theme.headlineFont, fontStyle: "italic", fontSize: 14, lineHeight: 1.4, color: "rgba(255,255,255,.85)" }}>&ldquo;{heroQuote}&rdquo;</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 28px 90px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>
        {/* Main column */}
        <div style={{ display: "grid", gap: 26 }}>
          {/* Gallery */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 12 }}>
            <div style={{ position: "relative", borderRadius: theme.radius, overflow: "hidden", aspectRatio: "4/3", background: gallery[activeImage] ? `url(${gallery[activeImage]}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})` }}>
              {badge && (
                <span style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, background: "rgba(20,16,12,.82)", color: "#fff", fontSize: 11, fontWeight: 800 }}>
                  <Crown size={12} /> {badge}
                </span>
              )}
              {gallery.length > 1 && (
                <>
                  <button type="button" aria-label="Previous photo" onClick={() => setActiveImage((i) => (i - 1 + gallery.length) % gallery.length)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronLeft size={16} /></button>
                  <button type="button" aria-label="Next photo" onClick={() => setActiveImage((i) => (i + 1) % gallery.length)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronRight size={16} /></button>
                  <span style={{ position: "absolute", bottom: 12, left: 14, padding: "4px 10px", borderRadius: 20, background: "rgba(20,16,12,.7)", color: "#fff", fontSize: 11, fontWeight: 700 }}>{activeImage + 1} / {gallery.length}</span>
                </>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateRows: "repeat(4, 1fr)", gap: 12 }}>
              {[0, 1, 2, 3].map((i) => {
                const src = thumbs[i];
                const isLast = i === 3 && extraCount > 0;
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => src && setActiveImage(images.indexOf(src))}
                    style={{ position: "relative", border: 0, padding: 0, borderRadius: 10, overflow: "hidden", cursor: src ? "pointer" : "default", background: src ? `url(${src}) center/cover` : `${ink}0d` }}
                  >
                    {isLast && (
                      <span style={{ position: "absolute", inset: 0, background: "rgba(20,16,12,.6)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800 }}>+{extraCount} Photos</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amenity strip */}
          {amenityStrip.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 18, background: theme.card, border: `1px solid ${border}`, borderRadius: theme.radius, padding: "18px 22px" }}>
              {amenityStrip.map((a) => (
                <span key={a.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 11.5, color: muted, minWidth: 72 }}>
                  <AmenityIcon facetKey={a.key} size={20} color={accent} />
                  {a.label}
                </span>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div>
            <div style={{ display: "flex", gap: 26, borderBottom: `1px solid ${border}`, fontSize: 13.5, fontWeight: 700 }}>
              {TABS.map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} style={{ border: 0, background: "none", cursor: "pointer", padding: "0 0 14px", color: tab === t ? accent : muted, borderBottom: tab === t ? `2px solid ${accent}` : "2px solid transparent", fontWeight: tab === t ? 800 : 650, fontSize: 13.5 }}>{t}</button>
              ))}
            </div>

            <div style={{ paddingTop: 26 }}>
              {tab === "Overview" && (
                <div style={{ display: "grid", gap: 18 }}>
                  <div>
                    <h2 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: "0 0 12px" }}>{itemLabelSingular} Overview</h2>
                    {overviewParagraphs.map((p, i) => <p key={i} style={{ color: muted, lineHeight: 1.8, fontSize: 14, margin: i === 0 ? 0 : "12px 0 0" }}>{p}</p>)}
                  </div>
                  {featureGrid.length > 0 && (
                    <div>
                      <h3 style={{ fontFamily: theme.headlineFont, fontSize: 18, margin: "8px 0 16px" }}>{itemLabelSingular} Features</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: 14, columnGap: 20 }}>
                        {featureGrid.map((f) => (
                          <span key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <FeatureIcon label={f.label} size={16} color={accent} />
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "Amenities" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: 14, columnGap: 20 }}>
                  {featureGrid.map((f) => (
                    <span key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <FeatureIcon label={f.label} size={16} color={accent} />
                      {f.label}
                    </span>
                  ))}
                </div>
              )}

              {tab === "Room Policies" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
                  <div>
                    <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Check In</h3>
                    {(policies?.checkIn || ["Check-in from 2:00 PM", "Valid photo ID required", "Early arrival subject to availability"]).map((l) => <p key={l} style={{ margin: "0 0 8px", fontSize: 13, color: muted }}>● {l}</p>)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Check Out</h3>
                    {(policies?.checkOut || ["Check-out by 12:00 PM", "Late checkout subject to availability", "Notify reception for assistance"]).map((l) => <p key={l} style={{ margin: "0 0 8px", fontSize: 13, color: muted }}>● {l}</p>)}
                  </div>
                </div>
              )}

              {tab === "Reviews" && (
                <ReviewsPanel reviews={reviews} avgRating={avgRating} reviewCount={reviewCount} theme={theme} />
              )}

              {tab === "Location" && (
                <div>
                  <div style={{ aspectRatio: "16/6", borderRadius: theme.radius, background: `${accent}12`, border: `1px solid ${border}`, display: "grid", placeItems: "center", color: muted, fontSize: 13, gap: 8 }}>
                    <MapPin size={20} color={accent} />
                    {store.address || `${store.name} location`}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Photo gallery strip */}
          {galleryPhotos.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: 0 }}>Photo Gallery</h2>
                <Link href={`/store/${slug}/hotel/gallery`} style={{ fontSize: 12.5, fontWeight: 700, color: accent, textDecoration: "none" }}>View All Photos →</Link>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" aria-label="Scroll gallery left" disabled={galleryStart === 0} onClick={() => setGalleryStart((s) => Math.max(0, s - galleryVisible))} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${border}`, background: theme.card, display: "grid", placeItems: "center", cursor: galleryStart === 0 ? "default" : "pointer", opacity: galleryStart === 0 ? 0.4 : 1, flexShrink: 0 }}><ChevronLeft size={14} /></button>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${galleryPage.length}, 1fr)`, gap: 12, flex: 1 }}>
                  {galleryPage.map((src, i) => <div key={galleryStart + i} style={{ aspectRatio: "4/3", borderRadius: 10, background: `url(${src}) center/cover` }} />)}
                </div>
                <button type="button" aria-label="Scroll gallery right" disabled={galleryStart + galleryVisible >= galleryPhotos.length} onClick={() => setGalleryStart((s) => Math.min(galleryPhotos.length - galleryVisible, s + galleryVisible))} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${border}`, background: theme.card, display: "grid", placeItems: "center", cursor: galleryStart + galleryVisible >= galleryPhotos.length ? "default" : "pointer", opacity: galleryStart + galleryVisible >= galleryPhotos.length ? 0.4 : 1, flexShrink: 0 }}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* Guest reviews (always visible below the fold, mirrors the reference) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: 0 }}>Guest Reviews</h2>
              <Link href={`/store/${slug}/hotel/rooms`} style={{ fontSize: 12.5, fontWeight: 700, color: accent, textDecoration: "none" }}>View All Reviews →</Link>
            </div>
            <ReviewsPanel reviews={reviews} avgRating={avgRating} reviewCount={reviewCount} theme={theme} compact />
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ position: "sticky", top: 90, display: "grid", gap: 14 }}>
          <div style={{ border: `1px solid ${border}`, borderRadius: theme.radius, padding: 20, background: theme.card, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(price, currency)} <span style={{ fontSize: 12, fontWeight: 600, color: muted }}>/ {rateUnit}</span></div>
                {avgRating != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, marginTop: 4 }}>
                    <Star size={13} color={accent} fill={accent} /> {avgRating.toFixed(1)} <span style={{ color: muted }}>({reviewCount} reviews)</span>
                  </div>
                )}
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#0a7a3c", background: "#0a7a3c14", padding: "5px 10px", borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0a7a3c" }} /> Available
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" }}><Calendar size={11} /> Check In</span>
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={{ border: 0, background: "none", fontSize: 12.5, fontWeight: 700, color: ink, width: "100%", padding: "4px 0 0" }} />
              </label>
              <label style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" }}><Calendar size={11} /> Check Out</span>
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={{ border: 0, background: "none", fontSize: 12.5, fontWeight: 700, color: ink, width: "100%", padding: "4px 0 0" }} />
              </label>
            </div>
            <label style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" }}><Users size={11} /> Guests</span>
              <input type="number" min={1} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} style={{ border: 0, background: "none", fontSize: 12.5, fontWeight: 700, color: ink, width: "100%", padding: "4px 0 0" }} />
            </label>

            {isBookable ? (
              <Link href={bookHref()} style={{ textAlign: "center", padding: "14px 0", borderRadius: 10, background: accent, color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13.5 }}>Book This {itemLabelSingular}</Link>
            ) : (
              <Link href={`/store/${slug}/hotel/contact`} style={{ textAlign: "center", padding: "14px 0", borderRadius: 10, background: accent, color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13.5 }}>Enquire Now</Link>
            )}
            <button type="button" onClick={toggleWishlist} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 10, border: `1px solid ${border}`, background: theme.bg, color: ink, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              <Heart size={15} color={wishlisted ? accent : ink} fill={wishlisted ? accent : "none"} /> {wishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
            </button>

            <div style={{ display: "grid", gap: 12, borderTop: `1px solid ${border}`, paddingTop: 14 }}>
              {guarantees.map((g) => (
                <span key={g.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
                  <GuaranteeIcon icon={g.icon} size={15} color={accent} />
                  <span>
                    <strong style={{ display: "block", fontSize: 12.5 }}>{g.label}</strong>
                    <span style={{ color: muted }}>{g.sublabel}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>

          {addonsPromo && (
            <div style={{ borderRadius: theme.radius, padding: 22, background: addonsPromo.image ? `linear-gradient(180deg, rgba(10,8,6,.35), rgba(10,8,6,.85)), url(${addonsPromo.image}) center/cover` : dark, color: "#fff", display: "grid", gap: 10 }}>
              <h3 style={{ fontFamily: theme.headlineFont, fontSize: 19, margin: 0 }}>{addonsPromo.title}</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,.82)", lineHeight: 1.6 }}>{addonsPromo.body}</p>
              <Link href={addonsPromo.ctaHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "11px 16px", background: "rgba(255,255,255,.94)", color: "#171411", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, width: "fit-content" }}>
                {addonsPromo.ctaLabel} <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </aside>
      </div>

      <Footer slug={slug} store={store} theme={theme} itemLabelPlural={itemLabelPlural} />
    </div>
  );
}

const FEATURE_ICON_MATCH: Array<[RegExp, React.ElementType]> = [
  [/bed/i, Bed], [/desk/i, Briefcase], [/mini ?bar/i, Wine], [/size|m²|sqm/i, Maximize2],
  [/tv|screen/i, Tv], [/safe/i, Lock], [/view/i, Building2], [/bathroom|bath/i, Bath],
  [/toiletr/i, Sparkles], [/housekeep/i, HomeIcon], [/service/i, ConciergeBell], [/smok/i, Ban], [/wifi/i, Wifi], [/ac|air/i, Wind],
];
function FeatureIcon({ label, size, color }: { label: string; size: number; color: string }) {
  const match = FEATURE_ICON_MATCH.find(([re]) => re.test(label));
  const Icon = match ? match[1] : Sparkles;
  return <Icon size={size} color={color} />;
}

function ReviewsPanel({ reviews, avgRating, reviewCount, theme, compact }: { reviews: ReviewItem[]; avgRating: number | null; reviewCount: number; theme: Theme; compact?: boolean }) {
  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;
  const shown = compact ? reviews.slice(0, 3) : reviews;

  return (
    <div style={{ display: "grid", gridTemplateColumns: avgRating != null ? "180px 1fr" : "1fr", gap: 20 }}>
      {avgRating != null && (
        <div style={{ border: `1px solid ${border}`, borderRadius: theme.radius, padding: 20, background: `${accent}0d`, textAlign: "center", display: "grid", gap: 6, alignContent: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{avgRating.toFixed(1)}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} color={accent} fill={i < Math.round(avgRating) ? accent : "none"} />)}
          </div>
          <div style={{ fontSize: 11.5, color: muted }}>Based on {reviewCount} reviews</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: shown.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr", gap: 16 }}>
        {shown.length === 0 ? (
          <p style={{ color: muted, fontSize: 13 }}>No reviews yet.</p>
        ) : shown.map((r) => (
          <div key={r.id} style={{ border: `1px solid ${border}`, borderRadius: theme.radius, padding: 16, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {r.avatarUrl ? <img src={r.avatarUrl} alt={r.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ width: 32, height: 32, borderRadius: "50%", background: `${accent}22`, color: accent, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{initials(r.name)}</span>}
              <div>
                <strong style={{ display: "block", fontSize: 12.5 }}>{r.name}</strong>
                <span style={{ fontSize: 10.5, color: muted }}>{r.date}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} color={accent} fill={i < r.rating ? accent : "none"} />)}</div>
            <p style={{ margin: 0, fontSize: 12.5, color: muted, lineHeight: 1.6 }}>{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer({ slug, store, theme, itemLabelPlural }: { slug: string; store: Props["store"]; theme: Theme; itemLabelPlural: string }) {
  const ink = theme.ink;
  return (
    <footer style={{ padding: "48px 28px 24px", background: theme.surfaceDark || "#171411", color: "rgba(255,255,255,.7)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.2fr", gap: 30, fontSize: 12.5 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ width: 30, height: 30, objectFit: "contain" }} /> : <span style={{ width: 30, height: 30, borderRadius: 6, background: "#fff2", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{initials(store.name)}</span>}
            <strong style={{ color: "#fff", fontFamily: theme.headlineFont, fontSize: 14 }}>{store.name}</strong>
          </div>
          <p style={{ margin: 0, lineHeight: 1.7 }}>Luxury stays. Lasting memories.</p>
        </div>
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          <strong style={{ color: "#fff", fontSize: 12.5 }}>Quick Links</strong>
          <Link href={`/store/${slug}`} style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
          <Link href={`/store/${slug}/hotel/rooms`} style={{ color: "inherit", textDecoration: "none" }}>{itemLabelPlural}</Link>
          <Link href={`/store/${slug}/hotel/experience`} style={{ color: "inherit", textDecoration: "none" }}>Amenities</Link>
        </div>
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          <strong style={{ color: "#fff", fontSize: 12.5 }}>Support</strong>
          <Link href={`/store/${slug}/hotel/contact`} style={{ color: "inherit", textDecoration: "none" }}>Contact Us</Link>
          <Link href={`/store/${slug}/account`} style={{ color: "inherit", textDecoration: "none" }}>Booking Policy</Link>
          <Link href={`/store/${slug}/hotel/story`} style={{ color: "inherit", textDecoration: "none" }}>About Us</Link>
        </div>
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          <strong style={{ color: "#fff", fontSize: 12.5 }}>Connect With Us</strong>
          <div style={{ display: "flex", gap: 10 }}>
            <Facebook size={15} /><Instagram size={15} /><Twitter size={15} /><Youtube size={15} /><Linkedin size={15} />
          </div>
          {store.address && <span style={{ display: "flex", gap: 8 }}><MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />{store.address}</span>}
          {store.contactPhone && <span style={{ display: "flex", gap: 8 }}><Phone size={13} />{store.contactPhone}</span>}
          {store.contactEmail && <span style={{ display: "flex", gap: 8 }}><Mail size={13} />{store.contactEmail}</span>}
        </div>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <strong style={{ color: "#fff", fontSize: 12.5 }}>Join Our Newsletter</strong>
          <span>Get exclusive offers and updates.</span>
          <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 8 }}>
            <input placeholder="Your email address" style={{ flex: 1, minWidth: 0, border: "1px solid rgba(255,255,255,.2)", background: "transparent", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12 }} />
            <button type="submit" style={{ border: 0, borderRadius: 8, width: 34, background: "#fff2", color: "#fff", cursor: "pointer" }}><ArrowRight size={14} /></button>
          </form>
        </div>
      </div>
      <div style={{ maxWidth: 1320, margin: "36px auto 0", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.12)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,.5)" }}>
        <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
        <span>Powered by BizNest</span>
      </div>
    </footer>
  );
}
