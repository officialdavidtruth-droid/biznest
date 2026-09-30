"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BedDouble, CalendarDays, Check, ChevronDown, Clock3, MapPin, Menu, Sparkles, Star, Users, Wifi, X } from "lucide-react";
import type { HotelContent, HotelRoom } from "@/lib/hotel-content";
import { AccountLink } from "@/components/storefront/account-link";

type Store = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

const FALLBACK = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=88";
const img = (u?: string | null) => u || FALLBACK;
const money = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

export function HotelCatalog({ store, slug, content }: { store: Store; slug: string; content: HotelContent }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("All Rooms");
  const [sort, setSort] = useState("recommended");

  const rooms = useMemo(() => {
    const filtered = content.rooms.filter((room) => {
      if (filter === "All Rooms") return true;
      if (filter === "Suites") return /suite/i.test(room.name);
      if (filter === "Accessible") return /accessible/i.test(room.name) || room.amenities.some((a) => /access/i.test(a));
      if (filter === "Family") return room.guests >= 3;
      if (filter === "Deluxe") return /deluxe/i.test(room.name);
      if (filter === "Executive") return /executive/i.test(room.name);
      return true;
    });
    const list = [...filtered];
    if (sort === "low") list.sort((a, b) => a.price - b.price);
    if (sort === "high") list.sort((a, b) => b.price - a.price);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [content.rooms, filter, sort]);

  const featured = content.rooms.filter((r) => r.featured).slice(0, 3);
  const amenities = content.amenities.slice(0, 6);
  const address = store.address || "Abuja, Nigeria";

  return (
    <div className="hotel-catalog-page">
      <section className="hc-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,16,12,.88) 0%, rgba(7,16,12,.56) 48%, rgba(7,16,12,.16) 100%), url(${img(store.bannerUrl)})` }}>
        <header className="hc-header">
          <Link href={`/store/${slug}`} className="hc-brand">
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span className="hc-mark">L</span>}
            <span><b>{store.name}</b><small>HOTEL &amp; SUITES</small></span>
          </Link>
          <button className="hc-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Open navigation">{menuOpen ? <X /> : <Menu />}</button>
          <nav className={menuOpen ? "open" : ""}>
            <Link href={`/store/${slug}`}>Home</Link>
            <Link className="active" href={`/store/${slug}/catalog`}>Rooms &amp; Suites</Link>
            <Link href={`/store/${slug}/amenities`}>Amenities</Link>
            <Link href={`/store/${slug}/dining`}>Dining</Link>
            <Link href={`/store/${slug}/experiences`}>Experiences</Link>
            <Link href={`/store/${slug}/about`}>About</Link>
            <Link href={`/store/${slug}/contact`}>Contact</Link>
          </nav>
          <div className="hc-actions"><AccountLink storeSlug={slug} ink="#fff" /><Link href={`/store/${slug}/book`} className="hc-book">Book Now <ArrowRight size={15} /></Link></div>
        </header>

        <div className="hc-hero-copy">
          <span className="hc-kicker">ROOMS &amp; AMENITIES</span>
          <h1>Stay beautifully.<br /><i>Feel completely at home.</i></h1>
          <p>Discover thoughtfully designed rooms, suites and hotel amenities created for comfortable stays in the heart of Abuja.</p>
          <div className="hc-hero-actions"><Link href="#rooms" className="hc-primary">Explore Rooms <ArrowRight size={16} /></Link><Link href="#amenities" className="hc-secondary">View Amenities</Link></div>
        </div>
        <div className="hc-location"><MapPin size={13} /> {address}</div>
      </section>

      <section className="hc-booking-bar">
        <label><CalendarDays size={17} /><span>CHECK IN<input type="date" /></span></label>
        <label><CalendarDays size={17} /><span>CHECK OUT<input type="date" /></span></label>
        <label><Users size={17} /><span>GUESTS<select defaultValue="2"><option value="1">1 Guest</option><option value="2">2 Guests</option><option value="3">3 Guests</option><option value="4">4 Guests</option></select></span></label>
        <Link href={`/store/${slug}/book`} className="hc-check">Check Availability <ArrowRight size={16} /></Link>
      </section>

      <main>
        <section className="hc-intro">
          <div><span className="hc-section-kicker">THE COLLECTION</span><h2>Rooms designed<br /><i>around you.</i></h2></div>
          <p>From elegant rooms for quick business trips to spacious suites for longer stays, choose the space that fits your visit. Every room combines modern comfort, considered details and the service you expect from {store.name}.</p>
        </section>

        <section id="rooms" className="hc-rooms-section">
          <div className="hc-section-head"><div><span className="hc-section-kicker">OUR ROOMS &amp; SUITES</span><h2>Find your perfect stay</h2></div><span className="hc-count">{rooms.length} room{rooms.length === 1 ? "" : "s"}</span></div>
          <div className="hc-toolbar">
            <div className="hc-filters">{["All Rooms", "Deluxe", "Executive", "Suites", "Family", "Accessible"].map((x) => <button key={x} className={filter === x ? "on" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div>
            <label className="hc-sort">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">Recommended</option><option value="low">Lowest price</option><option value="high">Highest price</option><option value="name">Name</option></select><ChevronDown size={14} /></label>
          </div>

          {rooms.length ? <div className="hc-room-grid">{rooms.map((room) => <RoomCard key={room.id} room={room} slug={slug} />)}</div> : <div className="hc-empty"><BedDouble size={28} /><h3>No rooms match this filter</h3><button onClick={() => setFilter("All Rooms")}>View all rooms</button></div>}
        </section>

        {featured.length > 0 && <section className="hc-featured"><div className="hc-featured-copy"><span className="hc-section-kicker">SIGNATURE STAYS</span><h2>Comfort with<br /><i>a little more.</i></h2><p>Explore our featured rooms and suites, selected to give you a simple starting point for your stay.</p><Link href={`/store/${slug}/book`} className="hc-primary dark">Book Your Stay <ArrowRight size={16} /></Link></div><div className="hc-featured-stack">{featured.map((room, i) => <Link key={room.id} href={`/store/${slug}/rooms/${room.slug}`} className={`hc-featured-card card-${i}`}><img src={img(room.image)} alt={room.name} /><div><span>{room.badge || "FEATURED"}</span><h3>{room.name}</h3><b>{money(room.price)} <small>/ night</small></b></div></Link>)}</div></section>}

        <section id="amenities" className="hc-amenities">
          <div className="hc-section-head"><div><span className="hc-section-kicker">MORE THAN A ROOM</span><h2>Everything you need to settle in.</h2></div><Link href={`/store/${slug}/amenities`} className="hc-text-link">Explore all amenities <ArrowRight size={15} /></Link></div>
          <div className="hc-amenity-grid">{amenities.map((a) => <article key={a.id}><div className="hc-amenity-image"><img src={img(a.image)} alt={a.title} /><span><Sparkles size={14} /></span></div><div><small>{a.category}</small><h3>{a.title}</h3><p>{a.description}</p><Link href={`/store/${slug}/amenities`}>Discover <ArrowRight size={14} /></Link></div></article>)}</div>
        </section>

        <section className="hc-final-cta" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,13,10,.9), rgba(5,13,10,.5)), url(${img(content.gallery.find((g) => g.category === "Outdoor Spaces")?.image || content.gallery[0]?.image)})` }}>
          <div><span className="hc-section-kicker">READY WHEN YOU ARE</span><h2>Your next stay<br /><i>starts here.</i></h2><p>Choose your room, check your dates and let us take care of the rest.</p><Link href={`/store/${slug}/book`} className="hc-primary">Book Your Stay <ArrowRight size={16} /></Link></div>
        </section>
      </main>

      <footer className="hc-footer"><div><div className="hc-brand footer-brand"><span className="hc-mark">L</span><span><b>{store.name}</b><small>HOTEL &amp; SUITES</small></span></div><p>A higher standard of hospitality.</p></div><div><b>Explore</b><Link href={`/store/${slug}/catalog`}>Rooms &amp; Suites</Link><Link href={`/store/${slug}/amenities`}>Amenities</Link><Link href={`/store/${slug}/dining`}>Dining</Link></div><div><b>Contact</b><span>{address}</span><span>{store.phone || "Contact the hotel"}</span><span>{store.email || "Email available"}</span></div><div><b>Reservations</b><p>For availability and special requests, our team is ready to help.</p><Link href={`/store/${slug}/contact`} className="hc-footer-link">Contact Us <ArrowRight size={14} /></Link></div></footer>
    </div>
  );
}

function RoomCard({ room, slug }: { room: HotelRoom; slug: string }) {
  return <article className="hc-room-card">
    <Link href={`/store/${slug}/rooms/${room.slug}`} className="hc-room-image"><img src={img(room.image)} alt={room.name} />{room.badge && <span className="hc-badge">{room.badge}</span>}<span className="hc-image-arrow"><ArrowRight size={15} /></span></Link>
    <div className="hc-room-body">
      <div className="hc-room-heading"><div><span className="hc-room-type">{room.view}</span><h3>{room.name}</h3></div><div className="hc-price"><b>{money(room.price)}</b><small>/ night</small></div></div>
      <p>{room.description}</p>
      <div className="hc-room-facts"><span><BedDouble size={14} /> {room.bed}</span><span><Users size={14} /> {room.guests} guests</span><span>⌗ {room.area}</span></div>
      <div className="hc-room-amenities">{room.amenities.slice(0, 3).map((a) => <span key={a}><Check size={12} /> {a}</span>)}</div>
      <div className="hc-card-actions"><Link href={`/store/${slug}/rooms/${room.slug}`}>View room <ArrowRight size={14} /></Link><Link href={`/store/${slug}/book`} className="hc-card-book">Book room</Link></div>
    </div>
  </article>;
}
