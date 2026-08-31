"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Star, Share2, Wifi, Tv, LockKeyhole, Volume2, Sparkles, Bath, Armchair, AlarmClock, BedDouble } from "lucide-react";
import { HotelReservationForm } from "@/components/storefront/hotel-reservation-form";

type Props = {
  store: any;
  slug: string;
  service: any;
  theme: any;
  hotelMode?: string;
};

function money(service: any) {
  return `${service.currency} ${Number(service.price).toLocaleString()}`;
}

function roomImages(service: any, store: any) {
  const images = Array.isArray(service.images) ? service.images.filter(Boolean) : [];
  return Array.from(new Set([...images, store.storyImage, store.bannerUrl].filter(Boolean) as string[])).slice(0, 5);
}

const AMENITIES = [
  [Wifi, "Air Conditioning"], [Tv, "Flat-Screen TV"], [Wifi, "High-Speed Wi-Fi"],
  [LockKeyhole, "Electronic Safe"], [Volume2, "Sound System"], [Sparkles, "Vanity mirror"],
  [Bath, "Bathrobes"], [Armchair, "Seating area"], [AlarmClock, "Alarm clock"],
];

export function HotelRoomDetail({ store, slug, service, theme, hotelMode }: Props) {
  const images = roomImages(service, store);
  const [selectedImage, setSelectedImage] = useState(0);
  const address = [store.business?.city, store.business?.state, store.business?.country].filter(Boolean).join(", ");
  const reviews = Array.isArray(service.reviews) ? service.reviews : [];
  const rating = reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : 4.9;
  const reviewCount = reviews.length || 245;
  const category = service.category?.name || "Luxury Rooms";
  const details = service.roomDetails || {};
  const bed = details.bed || "1 Bed";
  const bath = details.bath || "1 Bath";
  const size = details.size || "300 sqft";
  const guests = details.guests || "2 Guests";
  const roomType = details.type || category;
  const dark = hotelMode === "great-treasure" ? "#050907" : "#063522";
  const accent = theme.accent || "#0E5B45";

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
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span>{store.name?.[0] || "H"}</span>}
          <strong>{store.name}</strong>
        </Link>
        <nav>
          <Link href={`/store/${slug}`}>Home</Link>
          <Link href={`/store/${slug}/hotel/rooms`}>Rooms &amp; Suites</Link>
          <Link href={`/store/${slug}/hotel/experience`}>Restaurant</Link>
          <Link href={`/store/${slug}/hotel/gallery`}>Gallery</Link>
          <Link href={`/store/${slug}/hotel/story`}>About Us</Link>
          <Link href={`/store/${slug}/hotel/contact`}>Contact Us</Link>
        </nav>
        <Link href={`/store/${slug}/hotel/rooms`} className="hr-book-top">Book Now</Link>
      </header>

      <section className="hr-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.57), rgba(0,0,0,.24)), url(${images[0] || store.bannerUrl || ""})` }}>
        <div>
          <h1>Room Details</h1>
          <p><Link href={`/store/${slug}`}>Home</Link><span> / </span>Room Details</p>
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
                  <div className="hr-chip">{roomType}</div>
                </div>
                <div className="hr-rating"><Star size={17} fill="currentColor" /> <b>{rating.toFixed(1)}</b> ({reviewCount} Review{reviewCount === 1 ? "" : "s"})</div>
              </div>
              {address && <div className="hr-address"><MapPin size={15} /> {address}</div>}
              <div className="hr-price">{money(service)} <span>/ night</span></div>
              <div className="hr-specs">
                <span><BedDouble size={15} /> {bed}</span><span><Bath size={15} /> {bath}</span><span>⌗ {size}</span><span>♟ {guests}</span>
              </div>
              <button type="button" className="hr-share" onClick={() => navigator.share?.({ title: service.name, url: window.location.href })}><Share2 size={14} /> Share</button>
            </div>

            <HotelReservationForm storeSlug={slug} service={service} accent={accent} card={theme.card} ink={theme.ink} bg={theme.bg} radius={theme.radius} />
          </div>
        </section>

        <section className="hr-info-grid">
          <div className="hr-info-copy">
            <h2>Overview</h2>
            <p>{service.description || `Enjoy a thoughtfully designed ${service.name} with comfortable furnishings, attentive service and everything you need for a relaxed stay.`}</p>

            <h2>Room Amenities</h2>
            <p className="hr-small-copy">Everything you need for a comfortable and effortless stay.</p>
            <div className="hr-amenities">
              {AMENITIES.map(([Icon, label]) => <div key={String(label)}><span><Icon size={15} /></span><b>{label as string}</b></div>)}
            </div>

            <h2>Booking Rules</h2>
            <div className="hr-rules">
              <div><h3>Check In</h3><p>● Check-in from 2:00 PM</p><p>● Valid photo ID required</p><p>● Early arrival subject to availability</p></div>
              <div><h3>Check Out</h3><p>● Check-out by 12:00 PM</p><p>● Late checkout subject to availability</p><p>● Notify reception for assistance</p></div>
            </div>

            <h2>Location</h2>
            <div className="hr-map"><div className="hr-map-grid"></div><span className="hr-map-pin">●</span><small>{address || "Hotel location"}</small></div>
          </div>
        </section>
      </main>

      <footer className="hr-footer">
        <div><div className="hr-footer-brand"><span>{store.name?.[0] || "H"}</span><b>{store.name}</b></div><p>Luxury, comfort and exceptional service designed around you.</p></div>
        <div><b>Quick Links</b><Link href={`/store/${slug}`}>Home</Link><Link href={`/store/${slug}/hotel/rooms`}>Rooms &amp; Suites</Link><Link href={`/store/${slug}/account`}>Account</Link></div>
        <div><b>Contact</b><span>{store.contactPhone || "Contact available"}</span><span>{store.contactEmail || "Email available"}</span></div>
        <div><b>Newsletter</b><span>Get updates, offers and new arrivals.</span><form onSubmit={(e) => e.preventDefault()}><input placeholder="Your email" type="email" /><button>Subscribe</button></form></div>
      </footer>
    </div>
  );
}
