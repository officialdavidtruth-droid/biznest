"use client";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Clock3, MapPin, Users, Check, Gift, MessageSquare, Ticket, BellRing } from "lucide-react";
import { RestaurantHeader, RestaurantFooter, RestaurantBanner } from "@/components/storefront/restaurant-chrome";
import { createTableReservation, getReservationSlots } from "@/lib/actions/table-reservations";
import { timeLabel } from "@/lib/table-reservations";
import { businessAddress } from "@/lib/storefront/business-details";

const OCCASIONS = ["", "Birthday", "Anniversary", "Date night", "Business meal", "Family gathering", "Other"];

export function RestaurantReservations({ store, slug, info, image }: { store: any; slug: string; info: { open: boolean; today: string; maxDate: string; cfg: { maxParty: number; durationMins: number } }; image: string | null }) {
  const [date, setDate] = useState(info.today);
  const [party, setParty] = useState(2);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!time) return setError("Choose a time first.");
    start(async () => {
      const text = [occasion && `Occasion: ${occasion}`, notes].filter(Boolean).join(". ");
      const r = await createTableReservation(slug, { date, time, partySize: party, guestName, phone, email, notes: text });
      if (!r.success) return setError(r.error);
      setDone({ code: r.data.code, when: `${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} at ${timeLabel(time)}` });
    });
  };
  const addr = businessAddress(store);
  const available = (slots || []).filter((s) => s.available);

  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <RestaurantBanner slug={slug} crumb="Reservations" title="Reserve a" accent="Table" subtitle={`Book your table in advance and enjoy a delicious dining experience at ${store.name}.`} image={image} />
        <div className="rs-resv">
          <section className="rs-card">
            <h2>Make a Reservation</h2>
            {!info.open ? (
              <p>Online reservations aren&apos;t available right now. Please contact the restaurant directly to book a table.</p>
            ) : done ? (
              <div className="rs-done">
                <Check size={44} color="#16A34A" />
                <h2>Table reserved</h2>
                <p>{party} {party === 1 ? "guest" : "guests"} · {done.when}</p>
                <div className="code">{done.code}</div>
                <p>Show this code when you arrive at {store.name}. To change or cancel, call the restaurant and quote your code.</p>
              </div>
            ) : (
              <form className="rs-form" onSubmit={submit}>
                {addr && <label className="wide">Location<div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 7, padding: "13px 14px", border: "1px solid var(--rs-line)", borderRadius: 14, background: "#fff", fontWeight: 500 }}><MapPin size={16} color="#F4511E" /> {addr}</div></label>}
                <label>Date<input type="date" value={date} min={info.today} max={info.maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} required /></label>
                <label>Time
                  <select value={time} onChange={(e) => setTime(e.target.value)} required disabled={!available.length}>
                    <option value="">{slots === null ? "Loading…" : available.length ? "Choose a time" : "No tables free"}</option>
                    {available.map((s) => <option key={s.time} value={s.time}>{timeLabel(s.time)}</option>)}
                  </select>
                </label>
                <label>Number of Guests
                  <select value={party} onChange={(e) => setParty(Number(e.target.value))}>{Array.from({ length: info.cfg.maxParty }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>)}</select>
                </label>
                <label>Occasion (Optional)
                  <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>{OCCASIONS.map((o) => <option key={o} value={o}>{o || "None"}</option>)}</select>
                </label>
                <label>Your name<input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" required /></label>
                <label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required /></label>
                <label className="wide">Email (Optional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
                <label className="wide">Special Request (Optional)
                  <textarea value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, a window seat, a high chair…" />
                  <span className="rs-count">{notes.length}/200</span>
                </label>
                {slotError && <p className="rs-err">{slotError}</p>}
                {error && <p className="rs-err" role="alert">{error}</p>}
                <button className="rs-submit" disabled={busy || !time}>{busy ? "Reserving…" : "Reserve Table"}</button>
              </form>
            )}
          </section>
          <div className="rs-side-col">
            {image && <div className="rs-photo" style={{ backgroundImage: `url(${image})` }} />}
            <section className="rs-card rs-why">
              <h2 style={{ fontSize: 20 }}>Why Reserve with {store.name}?</h2>
              <ul>
                <li><CalendarDays size={22} /> Pick the date and time that suit you</li>
                <li><Users size={22} /> A table sized for your group, up to {info.cfg.maxParty} guests</li>
                <li><Gift size={22} /> Tell us about the occasion so we can plan for it</li>
                <li><Ticket size={22} /> Get a reservation code to show on arrival</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}
