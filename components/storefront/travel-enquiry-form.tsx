"use client";

import { useState, useTransition } from "react";
import { submitTravelEnquiry, startTravelBooking } from "@/lib/actions/travel-public";
import { formatMoney } from "@/lib/utils/format-money";

/** Enquiry form shown under the group tours on the Wanderly storefront. */
export function TravelEnquiryForm({ slug, packages }: { slug: string; packages: { id: string; name: string; seatsLeft: number | null; bookable?: boolean; depositPercent?: number; depositPerPerson?: number; currency?: string }[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ packageId: "", fullName: "", phone: "", email: "", travellers: 1, message: "", website: "" });
  const sel = packages.find((p) => p.id === f.packageId);
  const canBook = Boolean(sel?.bookable);
  const deposit = sel ? (sel.depositPerPerson ?? 0) * Math.max(1, f.travellers) : 0;
  const book = () => { setError(null); start(async () => { const r = await startTravelBooking(slug, f); if (r.success) window.location.assign(r.data.paymentUrl); else setError(r.error); }); };
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  if (done) return <div id="enquire" className="te-ok"><b>Thank you, we have your enquiry.</b><span>Your reference is {done}. Our team will contact you shortly.</span></div>;

  return (
    <form id="enquire" className="te" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await submitTravelEnquiry(slug, f); if (r.success) setDone(r.data.reference); else setError(r.error); }); }}>
      <h3>Enquire about a tour</h3>
      <select value={f.packageId} onChange={(e) => set("packageId", e.target.value)} aria-label="Tour">
        <option value="">General enquiry</option>
        {packages.map((p) => <option key={p.id} value={p.id} disabled={p.seatsLeft === 0}>{p.name}{p.seatsLeft === 0 ? " (fully booked)" : ""}</option>)}
      </select>
      <input required placeholder="Full name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
      <input required placeholder="Phone / WhatsApp" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      <input type="email" placeholder="Email (optional)" value={f.email} onChange={(e) => set("email", e.target.value)} />
      <input type="number" min={1} max={30} aria-label="Number of travellers" value={f.travellers} onChange={(e) => set("travellers", Number(e.target.value))} />
      <textarea placeholder="Anything we should know? (dates, budget, special requests)" value={f.message} onChange={(e) => set("message", e.target.value)} />
      <input className="te-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} />
      {error && <p className="te-err" role="alert">{error}</p>}
      {canBook && <button type="button" disabled={pending || !f.fullName.trim() || !f.phone.trim()} onClick={book}>{pending ? "Please wait…" : `Book now · pay ${formatMoney(deposit, sel?.currency ?? "NGN")} deposit (${sel?.depositPercent}%)`}</button>}
      <button type="submit" disabled={pending} className={canBook ? "te-alt" : undefined}>{pending ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}
