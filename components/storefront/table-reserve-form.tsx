"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Check, Minus, Plus, Users } from "lucide-react";
import { createTableReservation, getReservationSlots } from "@/lib/actions/table-reservations";
import { timeLabel } from "@/lib/table-reservations";

type Props = { slug: string; name: string; today: string; maxDate: string; maxParty: number; durationMins: number };

const field = "w-full rounded-xl border border-black/15 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none focus:border-neutral-900";

export function TableReserveForm({ slug, name, today, maxDate, maxParty, durationMins }: Props) {
  const [date, setDate] = useState(today);
  const [party, setParty] = useState(2);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [time, setTime] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { code: string; tableName: string | null; when: string }>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let live = true;
    setSlots(null); setTime(""); setSlotError("");
    getReservationSlots(slug, date, party).then((r) => {
      if (!live) return;
      if (r.success) setSlots(r.data.slots); else { setSlots([]); setSlotError(r.error); }
    });
    return () => { live = false; };
  }, [slug, date, party]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!time) return setError("Choose a time first.");
    start(async () => {
      const r = await createTableReservation(slug, { date, time, partySize: party, guestName, phone, email, notes });
      if (!r.success) { setError(r.error); return; }
      setDone({ code: r.data.code, tableName: r.data.tableName, when: `${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} at ${timeLabel(time)}` });
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-black/10 bg-white p-7 text-center text-neutral-900 shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-7 w-7" /></span>
        <h2 className="mt-4 text-2xl font-bold">Table reserved</h2>
        <p className="mt-1 text-sm text-neutral-600">{party} {party === 1 ? "guest" : "guests"} · {done.when}</p>
        <p className="mt-5 text-xs text-neutral-500">Your reservation code</p>
        <p className="mt-1 text-3xl font-extrabold tracking-widest">{done.code}</p>
        <p className="mt-4 text-sm text-neutral-600">Show this code when you arrive at {name}. Your table is held for you, so please arrive on time. To change or cancel, call the restaurant and quote your code.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 text-neutral-900">
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            <span className="mb-1.5 flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Date</span>
            <input type="date" value={date} min={today} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} className={field} required />
          </label>
          <div className="text-sm font-semibold">
            <span className="mb-1.5 flex items-center gap-1.5"><Users className="h-4 w-4" />Guests</span>
            <div className="flex items-center justify-between rounded-xl border border-black/15 bg-white px-2 py-1.5">
              <button type="button" aria-label="Fewer guests" onClick={() => setParty((p) => Math.max(1, p - 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-black/5"><Minus className="h-4 w-4" /></button>
              <span className="text-lg font-bold tabular-nums">{party}</span>
              <button type="button" aria-label="More guests" onClick={() => setParty((p) => Math.min(maxParty, p + 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-black/5"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <p className="mb-2 mt-6 text-sm font-semibold">Time <span className="font-normal text-neutral-500">· about {durationMins} minutes per sitting</span></p>
        {slots === null ? <div className="h-24 animate-pulse rounded-xl bg-black/5" /> : slotError ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{slotError}</p> : slots.length === 0 ? <p className="rounded-xl bg-black/5 p-3 text-sm text-neutral-600">No more times left on this day. Try another date.</p> : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button key={s.time} type="button" disabled={!s.available} onClick={() => setTime(s.time)} aria-pressed={time === s.time}
                className={`min-h-11 rounded-xl border px-2 text-sm font-semibold transition ${time === s.time ? "border-neutral-900 bg-neutral-900 text-white" : s.available ? "border-black/15 bg-white hover:border-neutral-900" : "cursor-not-allowed border-black/5 bg-black/5 text-neutral-400 line-through"}`}>
                {timeLabel(s.time)}
              </button>
            ))}
          </div>
        )}
        {slots && slots.length > 0 && slots.every((s) => !s.available) && !slotError && <p className="mt-3 text-sm text-neutral-600">We're fully booked for {party} on this day. Try another date or fewer guests.</p>}
      </section>

      <section className="space-y-3 rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <input className={field} placeholder="Your name" value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" required />
        <input className={field} placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
        <input className={field} placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <textarea className={field} placeholder="Anything we should know? Allergies, birthday, high chair…" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy || !time} className="min-h-12 w-full rounded-xl bg-neutral-900 px-5 text-base font-bold text-white transition active:scale-[.99] disabled:opacity-40">{busy ? "Reserving…" : time ? `Reserve for ${timeLabel(time)}` : "Choose a time"}</button>
      </section>
    </form>
  );
}
