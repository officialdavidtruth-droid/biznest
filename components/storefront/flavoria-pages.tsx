"use client";
import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Clock3, LayoutGrid, Mail, MapPin, Phone, X } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import { submitContactEnquiry } from "@/lib/actions/contact";
import { businessAddress, businessEmail, businessHours, businessPhone } from "@/lib/storefront/business-details";
import { FooterSocial } from "@/components/storefront/footer-social";
import { useStoreCategories } from "@/components/storefront/store-categories";
import { FlavoriaShell, Headline, bgImg } from "@/components/storefront/flavoria-chrome";
import { Card } from "@/components/storefront/flavoria-home";
import type { RestaurantItem } from "@/components/storefront/restaurant-home";

function PageHero({ label, title, accent = 1, text, image }: { label: string; title: string; accent?: number; text?: string; image?: string | null }) {
  return (
    <section className="fv-phero">
      <div className="fv-wrap">
        <div className="fv-phero-copy">
          <small>{label}</small>
          <h1><Headline text={title} accent={accent} /></h1>
          {text && <p>{text}</p>}
        </div>
        <div className="fv-phero-img" style={bgImg(image)} />
      </div>
    </section>
  );
}

/* ---------------- Menu ---------------- */
export function FlavoriaMenu({ store, slug, items }: { store: any; slug: string; items: RestaurantItem[] }) {
  const cats = useStoreCategories();
  const [pick, setPick] = useState<string>("");
  const topCats = cats.filter((c) => !c.parentId);
  const menuCats = topCats.length === 1 && cats.some((c) => c.parentId === topCats[0].id) ? cats.filter((c) => c.parentId === topCats[0].id) : topCats;
  const groups = useMemo(() => {
    const byName = new Map<string, RestaurantItem[]>();
    for (const i of items) { const k = i.categoryName || "More dishes"; byName.set(k, [...(byName.get(k) || []), i]); }
    const order = menuCats.map((c) => c.name).filter((n) => byName.has(n));
    for (const k of byName.keys()) if (!order.includes(k)) order.push(k);
    return order.map((name) => ({ name, items: byName.get(name)!, cat: menuCats.find((c) => c.name === name) }));
  }, [items, menuCats]);
  const shown = pick ? groups.filter((g) => g.name === pick) : groups;
  const withImg = items.filter((i) => i.image);
  const hero = withImg[0]?.image || store.bannerUrl || null;
  const special = withImg.slice().sort((a, b) => b.price - a.price)[0] || items[0];
  const desc = store.business?.description?.trim();
  return (
    <FlavoriaShell store={store} slug={slug} active="Menu">
      <PageHero label="Our menu" title="Explore Our Delicious Menu" accent={2} text={desc} image={hero} />
      <div className="fv-wrap">
        <div className="fv-chips">
          <button className={!pick ? "on" : ""} onClick={() => setPick("")}><LayoutGrid size={16} /> All menu</button>
          {groups.map((g) => <button key={g.name} className={pick === g.name ? "on" : ""} onClick={() => setPick(g.name)}>{g.name}</button>)}
        </div>
        {shown.length === 0 && <p className="fv-empty">The menu hasn&apos;t been published yet.</p>}
        {shown.map((g) => (
          <section key={g.name} className="fv-msec">
            <div className="fv-msec-head">
              <h2>{g.name}</h2><span />
              {!pick && g.items.length > 4 && <button onClick={() => { setPick(g.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}>View all <ArrowRight size={14} /></button>}
            </div>
            <div className="fv-grid">{(pick ? g.items : g.items.slice(0, 4)).map((i) => <Card key={i.id} item={i} slug={slug} />)}</div>
          </section>
        ))}
        {special && !pick && (
          <section className="fv-special">
            <div>
              <h2>Chef&apos;s Special</h2>
              <h3>{special.name}</h3>
              {special.description && <p>{special.description}</p>}
              <div><strong>{formatMoney(Math.round(special.price), special.currency)}</strong><Link className="fv-btn light" href={href(slug, `/${special.kind}/${special.id}`)}>Order now <ArrowRight size={14} /></Link></div>
            </div>
            <i style={bgImg(special.image)} />
          </section>
        )}
      </div>
    </FlavoriaShell>
  );
}

/* ---------------- Gallery ---------------- */
export type GalleryPic = { id: string; title: string; category: string; image: string };
export function FlavoriaGallery({ store, slug, pics }: { store: any; slug: string; pics: GalleryPic[] }) {
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<GalleryPic | null>(null);
  const cats = ["All", ...Array.from(new Set(pics.map((p) => p.category).filter(Boolean)))];
  const list = cat === "All" ? pics : pics.filter((p) => p.category === cat);
  return (
    <FlavoriaShell store={store} slug={slug} active="Gallery">
      <PageHero label="Our gallery" title="A Taste in Pictures" text={`Explore moments, dishes, and the unique atmosphere at ${store.name}.`} image={pics[0]?.image || store.bannerUrl} />
      <div className="fv-wrap">
        {cats.length > 2 && <div className="fv-chips">{cats.map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div>}
        {list.length === 0 ? <p className="fv-empty">No photos have been added yet.</p> : (
          <div className="fv-gal">{list.map((p) => <button key={p.id} style={bgImg(p.image)} onClick={() => setOpen(p)} aria-label={`View ${p.title}`} />)}</div>
        )}
        <section className="fv-special green">
          <div>
            <h2>Dine, Celebrate and <em>Create Memories</em></h2>
            <p>Book a table at {store.name} and be part of the story.</p>
            <div><Link className="fv-btn light" href={href(slug, "/reservations")}>Book a table <ArrowRight size={14} /></Link></div>
          </div>
          <i style={bgImg(pics[1]?.image || pics[0]?.image)} />
        </section>
      </div>
      {open && (
        <div className="fv-modal" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <button className="fv-modal-x" aria-label="Close" onClick={() => setOpen(null)}><X size={22} /></button>
          <img src={open.image} alt={open.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </FlavoriaShell>
  );
}

/* ---------------- Contact ---------------- */
export function FlavoriaContact({ store, slug, image }: { store: any; slug: string; image: string | null }) {
  const addr = businessAddress(store), phone = businessPhone(store), mail = businessEmail(store), hours = businessHours(store);
  const social = store.socialLinks && Object.values(store.socialLinks).some(Boolean) ? store.socialLinks : null;
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const send = (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    start(async () => {
      const r = await submitContactEnquiry(slug, f as any);
      if (r.success) { setF({ name: "", email: "", phone: "", subject: "", message: "" }); setMsg({ ok: true, text: "Message sent. We'll get back to you soon." }); }
      else setMsg({ ok: false, text: r.error || "Could not send your message. Please try again." });
    });
  };
  const info: [ReactNode, string, string][] = [
    [<MapPin key="a" size={22} />, "Our location", addr],
    [<Phone key="b" size={22} />, "Call us", phone],
    [<Mail key="c" size={22} />, "Email us", mail],
    [<Clock3 key="d" size={22} />, "Opening hours", hours],
  ];
  return (
    <FlavoriaShell store={store} slug={slug} active="Contact">
      <PageHero label="Get in touch" title="Contact Us" accent={0} text={`We'd love to hear from you. Reach out for reservations, events, or any enquiries.`} image={image} />
      <div className="fv-wrap fv-contact">
        <form className="fv-form" onSubmit={send}>
          <h2>Send us a message</h2>
          <label>Full name *<input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter your name" autoComplete="name" /></label>
          <label>Email address *<input required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Enter your email" autoComplete="email" /></label>
          <label>Phone number<input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Enter your phone number" autoComplete="tel" inputMode="tel" /></label>
          <label>Subject *<input required value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="What is this about?" /></label>
          <label>Message *<textarea required maxLength={500} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Type your message here..." /><span>{f.message.length}/500</span></label>
          {msg && <p className={msg.ok ? "ok" : "bad"} role="status">{msg.text}</p>}
          <button className="fv-btn lg" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
        </form>
        <aside className="fv-info-col">
          {info.filter(([, , v]) => v).map(([icon, label, v]) => <div key={label} className="fv-info-card">{icon}<span><b>{label}</b>{v}</span></div>)}
          {social && <div className="fv-info-card col"><b>Follow us</b><small>Stay connected for updates, specials, and events.</small><FooterSocial className="fv-social" social={social} /></div>}
        </aside>
      </div>
    </FlavoriaShell>
  );
}

/* ---------------- Reservation ---------------- */
import { CalendarDays, Gift, Ticket, Users } from "lucide-react";
import { useEffect } from "react";
import { createTableReservation, getReservationSlots } from "@/lib/actions/table-reservations";
import { timeLabel } from "@/lib/table-reservations";

const OCCASIONS = ["", "Birthday", "Anniversary", "Date night", "Business meal", "Family gathering", "Other"];
type ResvInfo = { open: boolean; today: string; maxDate: string; cfg: { maxParty: number; durationMins: number } };

export function FlavoriaReservations({ store, slug, info, image, initialDate, initialParty }: { store: any; slug: string; info: ResvInfo; image: string | null; initialDate?: string; initialParty?: number }) {
  const startDate = initialDate && initialDate >= info.today && initialDate <= info.maxDate ? initialDate : info.today;
  const [date, setDate] = useState(startDate);
  const [party, setParty] = useState(Math.min(Math.max(initialParty || 2, 1), info.cfg.maxParty));
  const [slots, setSlots] = useState<{ time: string; available: boolean }[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [time, setTime] = useState("");
  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { code: string; when: string }>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    if (!info.open) return;
    let live = true;
    setSlots(null); setTime(""); setSlotError("");
    getReservationSlots(slug, date, party).then((r) => {
      if (!live) return;
      if (r.success) setSlots(r.data.slots); else { setSlots([]); setSlotError(r.error); }
    });
    return () => { live = false; };
  }, [slug, date, party, info.open]);
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!time) return setError("Choose a time first.");
    start(async () => {
      const text = [occasion && `Occasion: ${occasion}`, notes].filter(Boolean).join(". ");
      const r = await createTableReservation(slug, { date, time, partySize: party, guestName, phone, email, notes: text });
      if (!r.success) return setError(r.error);
      setDone({ code: r.data.code, when: `${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} at ${timeLabel(time)}` });
    });
  };
  const free = (slots || []).filter((s) => s.available);
  return (
    <FlavoriaShell store={store} slug={slug} active="Reservation">
      <PageHero label="Reservation" title="Reserve a Table" text={`Book your table in advance and enjoy an exceptional dining experience at ${store.name}.`} image={image} />
      <div className="fv-wrap fv-resv">
        <section className="fv-form">
          <h2>Book your table</h2>
          {!info.open ? <p>Online reservations aren&apos;t available right now. Please contact the restaurant directly to book a table.</p> : done ? (
            <div className="fv-done">
              <h3>Table reserved</h3>
              <p>{party} {party === 1 ? "guest" : "guests"} · {done.when}</p>
              <div className="code">{done.code}</div>
              <p>Show this code when you arrive. To change or cancel, contact {store.name} and quote your code.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="fv-rform">
              <label>Date<input type="date" value={date} min={info.today} max={info.maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} required /></label>
              <label>Time
                <select value={time} onChange={(e) => setTime(e.target.value)} required disabled={!free.length}>
                  <option value="">{slots === null ? "Loading…" : free.length ? "Choose a time" : "No tables free"}</option>
                  {free.map((s) => <option key={s.time} value={s.time}>{timeLabel(s.time)}</option>)}
                </select>
              </label>
              <label>Number of guests
                <select value={party} onChange={(e) => setParty(Number(e.target.value))}>{Array.from({ length: info.cfg.maxParty }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>)}</select>
              </label>
              <label>Occasion (optional)
                <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>{OCCASIONS.map((o) => <option key={o} value={o}>{o || "None"}</option>)}</select>
              </label>
              <label>Your name<input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" required /></label>
              <label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required /></label>
              <label className="wide">Email (optional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
              <label className="wide">Special request (optional)
                <textarea value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Eg. Window seat, vegan meal, high chair, etc." />
                <span>{notes.length}/200</span>
              </label>
              {slotError && <p className="bad wide">{slotError}</p>}
              {error && <p className="bad wide" role="alert">{error}</p>}
              <button className="fv-btn lg wide" disabled={busy || !time}>{busy ? "Reserving…" : "Reserve table"}</button>
            </form>
          )}
        </section>
        <aside className="fv-resv-side">
          <div className="fv-resv-photo" style={bgImg(image)} />
          <div className="fv-why">
            <h3>Why reserve with {store.name}?</h3>
            <ul>
              <li><CalendarDays size={20} /> Pick the date and time that suit you</li>
              <li><Users size={20} /> A table for your group, up to {info.cfg.maxParty} guests</li>
              <li><Gift size={20} /> Tell us the occasion so we can plan for it</li>
              <li><Ticket size={20} /> Get a reservation code to show on arrival</li>
            </ul>
          </div>
        </aside>
      </div>
      <div className="fv-wrap">
        <section className="fv-special">
          <div>
            <h2>Planning a <em>Special Occasion?</em></h2>
            <p>Birthday, anniversary, or a private dinner? Tell {store.name} and they&apos;ll help make it memorable.</p>
            <div><Link className="fv-btn light" href={href(slug, "/contact")}>Contact us <ArrowRight size={14} /></Link></div>
          </div>
          <i style={bgImg(image)} />
        </section>
      </div>
    </FlavoriaShell>
  );
}
