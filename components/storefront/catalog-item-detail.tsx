"use client";
import { isHotelBusiness } from "@/lib/business-identity";
import { whatsappLink } from "@/lib/utils/whatsapp-link";

import { formatMoney } from "@/lib/utils/format-money";
import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Search, Star } from "lucide-react";
import { ShareButton } from "@/components/storefront/share-button";
import { MenuLinks } from "@/components/storefront/store-menu";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { getCatalogItemPreset } from "@/lib/catalog-item-presets";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { getUnitBookingNiche, resolveBookingRules } from "@/lib/storefront/unit-booking-niche";
import { NewsletterInlineForm } from "@/components/storefront/newsletter-inline-form";
import { socialHref, FooterSocial } from "@/components/storefront/footer-social";
import { PropertyMap } from "@/components/storefront/property-map";
import { resolveBusinessMode } from "@/lib/business-experience";

type Props = {
  store: any;
  slug: string;
  service: any;
  /** Aggregate over every review of the service (the `service.reviews` list is only the latest few). */
  reviewStats?: { average: number | null; count: number } | null;
  theme: any;
  businessCategory?: string | null;
  hotelMode?: string;
  /**
   * The property's configured check-in / check-out (or pickup / return) times,
   * e.g. "14:00". Optional: when omitted the niche default (or
   * storefrontConfig.unitBooking.stayTimes) is used.
   */
  stayTimes?: { checkIn?: string | null; checkOut?: string | null } | null;
};

// A price of 0 means "no fixed price", not "free": quote-based items show
// "Custom Quote" (same wording as the services/pricing list pages). A
// bookable item priced at 0 really is free to book.
function hasPrice(service: any) {
  return Number(service.price) > 0;
}

function money(service: any) {
  if (hasPrice(service)) return formatMoney(service.price, service.currency);
  return service.isBookable ? "Free" : "Custom Quote";
}

// Gallery shows only this item's own photos. Store-level banner/story images
// are page decoration (the hero falls back to the banner separately), not
// pictures of the item, so they are never mixed into the gallery.
function itemImages(service: any) {
  const images = Array.isArray(service.images) ? service.images.filter(Boolean) : [];
  return Array.from(new Set(images as string[])).slice(0, 8);
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
export function CatalogItemDetail({ store, slug, service, reviewStats, theme, businessCategory, hotelMode, stayTimes }: Props) {
  const images = itemImages(service);
  const [selectedImage, setSelectedImage] = useState(0);
  const address = [store.business?.city, store.business?.state, store.business?.country].filter(Boolean).join(", ");
  const reviews = Array.isArray(service.reviews) ? service.reviews : [];
  const reviewCount = reviewStats ? reviewStats.count : reviews.length;
  const rating = reviewStats
    ? (reviewStats.count > 0 ? reviewStats.average : null)
    : (reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : null);
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
  const isHotel = isHotelBusiness(businessCategory);
  // Wording for unit-based items (night / day / event / booking...) and the
  // start/end rules come from the niche config, not hard-coded hotel copy.
  const niche = getUnitBookingNiche(businessCategory, store.storefrontConfig);
  const bookingRules = isUnitBased ? resolveBookingRules(niche, stayTimes) : null;
  const priceSuffix = !hasPrice(service) ? "" : isUnitBased ? `/ ${niche.rateUnit}` : service.durationMins ? `/ ${service.durationMins} min` : "";
  const dark = hotelMode === "great-treasure" ? "#050907" : `color-mix(in srgb, ${theme.accent || "#0E5B45"} 40%, #000)`;
  const accent = theme.accent || "#0E5B45";
  const catalogHref = `/store/${slug}/catalog`;

  // Enquiry actions for items that can't be booked online. Only channels the
  // merchant has actually configured are rendered (no placeholder numbers).
  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, string | null | undefined>;
  const phone = String(store.contactPhone || "").trim();
  const email = String(store.contactEmail || "").trim();
  const whatsappRaw = String(social.whatsapp || "").trim();
  const hasSocial = (["instagram", "facebook", "twitter", "tiktok", "whatsapp"] as const).some((k) => typeof social[k] === "string" && String(social[k]).trim());
  const lat = Number(attrs.lat), lng = Number(attrs.lng);
  const hasCoords = typeof attrs.lat === "number" && typeof attrs.lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name}, ${address}`)}` : "";
  const itemLabel = terminology.catalogSingular.toLowerCase();
  const enquiryText = `Hi ${store.name}, I'm interested in "${service.name}". Could you share details and next steps?`;
  const whatsappHref = whatsappLink(whatsappRaw, /^https?:/i.test(whatsappRaw) ? undefined : enquiryText) ?? "";
  const mailHref = email ? `mailto:${email}?subject=${encodeURIComponent(`Enquiry: ${service.name}`)}&body=${encodeURIComponent(enquiryText)}` : "";
  const quoteMode = resolveBusinessMode(businessCategory, { sellsProducts: store.sellsProducts, offersServices: store.offersServices });
  const offersQuote = !isHotel && (quoteMode === "service" || quoteMode === "hybrid");
  const actionStyle = (primary: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, borderRadius: 999,
    fontSize: 13, fontWeight: 800, textDecoration: "none",
    background: primary ? accent : "transparent", color: primary ? "#fff" : "var(--hr-ink)",
    border: primary ? "0" : "1px solid var(--hr-border)",
  });

  return (
    <div className="hotel-room-reference" style={{ "--hr-bg": theme.bg, "--hr-ink": theme.ink, "--hr-card": theme.card, "--hr-accent": accent, "--hr-dark": dark, "--hr-border": theme.border || "#E7E3D9", "--hr-muted": theme.muted || "#74736D", "--hr-head": theme.headlineFont, "--hr-font": theme.font } as React.CSSProperties}>
      {(phone || email || address || hasSocial) && (
        <div className="hr-topbar">
          {phone && <a href={`tel:${phone}`}>☎ {phone}</a>}
          {email && <a href={`mailto:${email}`}>✉ {email}</a>}
          {address && <span>⌖ {address}</span>}
          {hasSocial && <FooterSocial social={social} className="hr-top-social" iconSize={14} />}
        </div>
      )}
      <header className="hr-header">
        <Link href={`/store/${slug}`} className="hr-brand">
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span>{store.name?.[0] || "S"}</span>}
          <strong>{store.name}</strong>
        </Link>
        <nav>
          <MenuLinks slug={slug} fallbackNode={<>
            <Link href={`/store/${slug}`}>Home</Link>
            <Link href={catalogHref}>{terminology.catalog}</Link>
            <Link href={`/store/${slug}/about`}>About</Link>
            <Link href={`/store/${slug}/contact`}>Contact</Link>
          </>} />
        </nav>
        <div className="hr-header-actions">
          <Link href={`/store/${slug}/search`} aria-label="Search"><Search size={19} /></Link>
          <CartLink storeSlug={slug} accent={accent} onAccent="#fff" ink={theme.ink} />
          <AccountLink storeSlug={slug} ink={theme.ink} />
        </div>
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
            <div className="hr-thumbs" style={images.length < 2 ? { display: "none" } : undefined}>
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
              <ShareButton title={service.name} />
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
                rateUnit={niche.rateUnit}
                periodUnit={niche.periodUnit ?? niche.rateUnit}
                startLabel={niche.startDateLabel}
                otherOptionsHref={isUnitBased ? catalogHref : undefined}
                startOpen
              />
            ) : (
              <div className="hr-book-card">
                <h3>{offersQuote ? "Request a quote" : "Get in touch"}</h3>
                <p style={{ fontSize: 13, color: "var(--hr-muted)", margin: 0 }}>
                  {offersQuote
                    ? `Tell ${store.name} what you need and get a tailored quote for this ${itemLabel}.`
                    : `Contact ${store.name} to arrange this ${itemLabel}.`}
                </p>
                {offersQuote && <Link href={`/store/${slug}/start-project`} style={actionStyle(true)}>Get a Quote</Link>}
                {whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" style={actionStyle(!offersQuote)}>Chat on WhatsApp</a>}
                {phone && <a href={`tel:${phone}`} style={actionStyle(!offersQuote && !whatsappHref)}>Call {phone}</a>}
                {email && <a href={mailHref} style={actionStyle(false)}>Email {email}</a>}
                {!offersQuote && !whatsappHref && !phone && !email && (
                  <Link href={`/store/${slug}/contact`} style={actionStyle(true)}>Contact {store.name}</Link>
                )}
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

            {bookingRules && (
              <>
                <h2>Booking Rules</h2>
                <div className="hr-rules">
                  {[bookingRules.start, bookingRules.end].map((rule) => (
                    <div key={rule.title}><h3>{rule.title}</h3>{rule.items.map((item) => <p key={item}>● {item}</p>)}</div>
                  ))}
                </div>
              </>
            )}

            {(hasCoords || address) && (
              <>
                <h2>Location</h2>
                {hasCoords && <PropertyMap properties={[{ id: service.id, name: service.name, priceLabel: money(service), lat, lng }]} accent={accent} />}
                {address && (
                  <p className="hr-small-copy">
                    <MapPin size={14} style={{ verticalAlign: "-2px" }} /> {address}{" "}
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ color: accent, fontWeight: 700 }}>Get directions</a>
                  </p>
                )}
              </>
            )}

            {reviews.length > 0 && (
              <>
                <h2>Reviews{rating !== null && ` · ${rating.toFixed(1)} (${reviewCount})`}</h2>
                <div style={{ display: "grid", gap: 14 }}>
                  {reviews.map((r: any) => {
                    const n = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
                    const first = String(r.author?.name || "").trim().split(/\s+/)[0] || "Customer";
                    const when = r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-NG", { month: "short", year: "numeric", timeZone: "UTC" }) : "";
                    return (
                      <article key={r.id} style={{ border: "1px solid var(--hr-border)", borderRadius: 12, padding: 14, background: "var(--hr-card)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                          <b>{first}</b>
                          <span style={{ color: "var(--hr-muted)" }}>{when}</span>
                        </div>
                        <div aria-label={`${n} out of 5 stars`} style={{ color: accent, margin: "4px 0", letterSpacing: 2 }}>{"★".repeat(n)}<span style={{ opacity: 0.25 }}>{"★".repeat(5 - n)}</span></div>
                        {r.comment && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{r.comment}</p>}
                        {r.response?.content && (
                          <p style={{ margin: "10px 0 0", paddingLeft: 10, borderLeft: `3px solid ${accent}`, fontSize: 13, color: "var(--hr-muted)" }}><b>Reply from {store.name}:</b> {r.response.content}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
                {reviewCount > reviews.length && <p className="hr-small-copy">Showing the latest {reviews.length} of {reviewCount} reviews.</p>}
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="hr-footer">
        <div><div className="hr-footer-brand"><span>{store.name?.[0] || "S"}</span><b>{store.name}</b></div><p>Quality, care and exceptional service designed around you.</p></div>
        <div><b>Quick Links</b><Link href={`/store/${slug}`}>Home</Link><Link href={catalogHref}>{terminology.catalog}</Link><Link href={`/store/${slug}/account`}>Account</Link></div>
        <div><b>Contact</b>{phone && <a href={`tel:${phone}`}>{phone}</a>}{email && <a href={`mailto:${email}`}>{email}</a>}{!phone && !email && <Link href={`/store/${slug}/contact`}>Contact us</Link>}</div>
        <div><b>Newsletter</b><span>Get updates, offers and new arrivals.</span><NewsletterInlineForm slug={slug} inputPlaceholder="Your email">Subscribe</NewsletterInlineForm></div>
      </footer>
    </div>
  );
}