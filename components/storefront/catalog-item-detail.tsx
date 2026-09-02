"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Star, Share2 } from "lucide-react";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { getCatalogItemPreset } from "@/lib/catalog-item-presets";
import { getBusinessTerminology } from "@/lib/business-terminology";

type Props = {
  store: any;
  slug: string;
  service: any;
  theme: any;
  businessCategory?: string | null;
  hotelMode?: string;
};

function money(service: any) {
  return `${service.currency} ${Number(service.price).toLocaleString()}`;
}

function itemImages(service: any, store: any) {
  const images = Array.isArray(service.images) ? service.images.filter(Boolean) : [];
  return Array.from(new Set([...images, store.storyImage, store.bannerUrl].filter(Boolean) as string[])).slice(0, 5);
}

/**
 * The rich, magazine-style item detail layout originally built only for
 * hotel rooms (see git history: hotel-room-detail.tsx), now generalized so
 * every niche gets the same presentation -- gallery + booking summary,
 * amenities grid, booking rules, location -- instead of the plainer
 * fallback that used to live inline in service/[serviceId]/page.tsx.
 *
 * Amenities and specs are pulled from Service.attributes (written by
 * ServiceForm, see lib/catalog-item-presets.ts) so a hotel room shows real
 * amenities, a salon appointment shows service details, etc. Booking uses
 * the shared BookingWidget (handles both unit-based and appointment-based
 * services) rather than the hotel-only reservation form.
 */
export function CatalogItemDetail({ store, slug, service, theme, businessCategory, hotelMode }: Props) {
  const images = itemImages(service, store);
  const [selectedImage, setSelectedImage] = useState(0);
  const address = [store.business?.city, store.business?.state, store.business?.country].filter(Boolean).join(", ");
  const reviews = Array.isArray(service.reviews) ? service.reviews : [];
  const rating = reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : null;
  const reviewCount = reviews.length;
  const preset = getCatalogItemPreset(businessCategory);
  const terminology = getBusinessTerminology(businessCategory);
  const category = service.category?.name || preset.sectionLabel;
  const attrs = (service.attributes && typeof service.attributes === "object" && !Array.isArray(service.attributes) ? service.attributes : {}) as Record<string, unknown>;

  // Amenities/specs grid -- quick specs + spec fields the merchant filled
  // in on ServiceForm, e.g. bed type & Wi-Fi for a room, skill level &
  // aftercare notes for a beauty service. Falls back to a short generic
  // list so the section is never empty for older services saved before
  // attributes existed.
  const specEntries = [...preset.quickSpecs, ...preset.specFields]
    .map((f) => ({ label: f.label.replace(/\s*\(Optional\)$/, ""), value: attrs[f.key] }))
    .filter((f) => f.value !== undefined && f.value !== "");
  const amenities = specEntries.length > 0 ? specEntries : [{ label: "Quality service", value: "Guaranteed" }, { label: "Support", value: "Responsive" }];

  const isUnitBased = Boolean(service.totalUnits);
  const isHotel = businessCategory === "Hotel & Lodging";
  const priceSuffix = isUnitBased ? "/ night" : service.durationMins ? `/ ${service.durationMins} min` : "";
  const dark = hotelMode === "great-treasure" ? "#050907" : "#063522";
  const accent = theme.accent || "#0E5B45";
  const catalogHref = `/${slug}`;

  return (
    <div className="hotel-room-reference" style={{ "--hr-bg": theme.bg, "--hr-ink": theme.ink, "--hr-card": theme.card, "--hr-accent": accent, "--hr-dark": dark, "--hr-border": theme.border || "#E7E3D9", "--hr-muted": theme.muted || "#74736D", "--hr-head": theme.headlineFont, "--hr-font": theme.font } as React.CSSProperties}>
      <div className="hr-topbar">
        <span>☎ {store.contactPhone || "+1 800 555 0199"}</span>
        <span>✉ {store.contactEmail || "reservations@example.com"}</span>
        {address && <span>⌖ {address}</span>}
        <span className="hr-top-social">● ● ● ● ●</span>
      </div>
      <header className="hr-header">
        <Link href={`/store/${slug}`} className="hr-brand">
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span>{store.name?.[0] || "S"}</span>}
          <strong>{store.name}</strong>
        </Link>
        <nav>
          <Link href={`/store/${slug}`}>Home</Link>
          <Link href={catalogHref}>{terminology.catalog}</Link>
          <Link href={`/store/${slug}/account`}>Account</Link>
        </nav>
        <Link href={catalogHref} className="hr-book-top">{isUnitBased ? "Book Now" : "View " + terminology.catalog}</Link>
      </header>

      <section className="hr-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.57), rgba(0,0,0,.24)), url(${images[0] || store.bannerUrl || ""})` }}>
        <div>
          <h1>{terminology.catalogSingular} Details</h1>
          <p><Link href={`/store/${slug}`}>Home</Link><span> / </span>{terminology.catalogSingular} Details</p>
        </div>
      </section>

      <main className="hr-main">
        <section className="hr-gallery-booking">
          <div className="hr-gallery">
            <div className="hr-thumbs">
              {images.map((src: string, i: number) => <button type="button" onClick={() => setSelectedImage(i)} aria-label={`View ${service.name} image ${i + 1}`} key={src + i}><img src={src} alt={`${service.name} ${i + 1}`} /></button>)}
            </div>
            <div className="hr-main-image" id="hr-image-0">
              {images[selectedImage] ? <img src={images[selectedImage]} alt={service.name} /> : <div className="hr-image-placeholder">{service.name?.[0]}</div>}
              <span className="hr-image-zoom">⌕</span>
            </div>
          </div>

          <div className="hr-room-summary">
            <div className="hr-summary-card">
              <div className="hr-summary-title-row">
                <div>
                  <h2>{service.name}</h2>
                  <div className="hr-chip">{category}</div>
                </div>
                {rating !== null && (
                  <div className="hr-rating"><Star size={17} fill="currentColor" /> <b>{rating.toFixed(1)}</b> ({reviewCount} Review{reviewCount === 1 ? "" : "s"})</div>
                )}
              </div>
              {address && <div className="hr-address"><MapPin size={15} /> {address}</div>}
              <div className="hr-price">{money(service)} <span>{priceSuffix}</span></div>
              {specEntries.length > 0 && (
                <div className="hr-specs">
                  {specEntries.slice(0, 4).map((f) => <span key={f.label}>{String(f.value)}</span>)}
                </div>
              )}
              <button type="button" className="hr-share" onClick={() => navigator.share?.({ title: service.name, url: window.location.href })}><Share2 size={14} /> Share</button>
            </div>

            {service.isBookable ? (
              <BookingWidget
                storeSlug={slug}
                serviceId={service.id}
                serviceName={service.name}
                servicePrice={Number(service.price)}
                currency={service.currency}
                durationMins={service.durationMins}
                totalUnits={service.totalUnits}
                accent={accent}
                ink={theme.ink}
                bg={theme.bg}
                radius={theme.radius}
                card={theme.card}
                headlineFont={theme.headlineFont}
                unitLabel={terminology.unitLabel?.toLowerCase() || "unit"}
                otherOptionsHref={isUnitBased ? catalogHref : undefined}
                startOpen
              />
            ) : (
              <div className="hr-book-card">
                <h3>Get in touch</h3>
                <p style={{ fontSize: 10, color: "var(--hr-muted)", margin: 0 }}>Contact {store.name} to arrange this {terminology.catalogSingular.toLowerCase()}.</p>
              </div>
            )}
          </div>
        </section>

        <section className="hr-info-grid">
          <div className="hr-info-copy">
            <h2>Overview</h2>
            <p>{service.description || `Enjoy ${service.name}, thoughtfully delivered with attentive service and everything you need.`}</p>

            <h2>{isHotel ? "Room Amenities" : "Details"}</h2>
            <p className="hr-small-copy">Everything you need to know before you book.</p>
            <div className="hr-amenities">
              {amenities.map((a) => <div key={a.label}><span>●</span><b>{a.label}: {String(a.value)}</b></div>)}
            </div>

            {isUnitBased && (
              <>
                <h2>Booking Rules</h2>
                <div className="hr-rules">
                  <div><h3>Check In</h3><p>● Check-in from 2:00 PM</p><p>● Valid photo ID required</p><p>● Early arrival subject to availability</p></div>
                  <div><h3>Check Out</h3><p>● Check-out by 12:00 PM</p><p>● Late checkout subject to availability</p><p>● Notify reception for assistance</p></div>
                </div>
              </>
            )}

            <h2>Location</h2>
            <div className="hr-map"><div className="hr-map-grid"></div><span className="hr-map-pin">●</span><small>{address || `${store.name} location`}</small></div>
          </div>
        </section>
      </main>

      <footer className="hr-footer">
        <div><div className="hr-footer-brand"><span>{store.name?.[0] || "S"}</span><b>{store.name}</b></div><p>Quality, care and exceptional service designed around you.</p></div>
        <div><b>Quick Links</b><Link href={`/store/${slug}`}>Home</Link><Link href={catalogHref}>{terminology.catalog}</Link><Link href={`/store/${slug}/account`}>Account</Link></div>
        <div><b>Contact</b><span>{store.contactPhone || "Contact available"}</span><span>{store.contactEmail || "Email available"}</span></div>
        <div><b>Newsletter</b><span>Get updates, offers and new arrivals.</span><form onSubmit={(e) => e.preventDefault()}><input placeholder="Your email" type="email" /><button>Subscribe</button></form></div>
      </footer>
    </div>
  );
}
