"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTravelProposal, payTravelProposal } from "@/lib/actions/travel-proposal";
import { formatMoney } from "@/lib/utils/format-money";
import { accentInk, readableOn } from "@/lib/account-theme";
import type { ProposalView } from "@/lib/travel-proposal";

const KIND: Record<string, string> = { FLIGHT: "Flight", HOTEL: "Hotel", TRANSFER: "Transfer", TOUR: "Tour", VISA: "Visa", INSURANCE: "Insurance", OTHER: "Service" };
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);
const range = (a: string | null, b: string | null) => (a && b && date(a) !== date(b) ? `${date(a)} – ${date(b)}` : date(a));

export function ProposalClient({ view }: { view: ProposalView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trip, store, money: m } = view;
  const accent = store.primary && /^#[0-9a-f]{6}$/i.test(store.primary) ? store.primary : "#111827";
  const ink = accentInk(accent);
  const on = readableOn(accent);
  const $ = (n: number) => formatMoney(n, trip.currency);
  const accepted = !!trip.acceptedAt;
  const canAccept = !accepted && !trip.closed && !trip.expired && m.total > 0;
  const contact = [store.contactPhone && { href: `tel:${store.contactPhone}`, label: "Call" }, store.contactEmail && { href: `mailto:${store.contactEmail}`, label: "Email" }].filter(Boolean) as { href: string; label: string }[];

  const accept = () => { setError(null); start(async () => { const r = await acceptTravelProposal(store.slug, view.token, { fullName: name, agree }); if (!r.success) setError(r.error); else router.refresh(); }); };
  const pay = (id: "deposit" | "next" | "balance") => { setError(null); start(async () => { const r = await payTravelProposal(store.slug, view.token, id); if (!r.success) setError(r.error); else window.location.assign(r.data.url); }); };

  return (
    <main className="tp" style={{ ["--a" as string]: accent, ["--on" as string]: on, ["--ink" as string]: ink }}>
      <style>{`
        .tp{min-height:100vh;background:#f6f7f9;color:#111827;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:96px}
        .tp *{box-sizing:border-box}
        .tp-w{max-width:720px;margin:0 auto;padding:0 16px}
        .tp-top{background:#fff;border-bottom:1px solid #e5e7eb}
        .tp-top .tp-w{display:flex;align-items:center;gap:10px;height:56px}
        .tp-top img{height:30px;width:auto;border-radius:6px}
        .tp-top b{font-size:15px}
        .tp-hero{background:var(--a);color:var(--on);padding:28px 0 32px}
        .tp-hero h1{margin:6px 0 4px;font-size:26px;line-height:1.15;font-weight:800}
        .tp-hero p{margin:0;opacity:.85;font-size:14px}
        .tp-chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.18);padding:4px 10px;border-radius:99px}
        .tp-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px;margin-top:14px}
        .tp-card h2{margin:0 0 12px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}
        .tp-banner{border-radius:14px;padding:14px 16px;margin-top:14px;font-size:14px;line-height:1.5}
        .tp-ok{background:#ecfdf5;color:#065f46}.tp-warn{background:#fffbeb;color:#92400e}.tp-err{background:#fef2f2;color:#991b1b}
        .tp-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #f1f5f9;font-size:14px}
        .tp-row:first-of-type{border-top:0}
        .tp-row small{display:block;color:#6b7280;font-size:12px;margin-top:2px}
        .tp-day{display:flex;gap:12px;padding:10px 0;border-top:1px solid #f1f5f9}.tp-day:first-of-type{border-top:0}
        .tp-day i{flex:none;width:30px;height:30px;border-radius:50%;background:var(--a);color:var(--on);font-style:normal;font-weight:800;font-size:12px;display:grid;place-items:center}
        .tp-day p{margin:2px 0 0;font-size:13px;color:#4b5563;white-space:pre-line}
        .tp-tot{font-size:22px;font-weight:800}
        .tp-terms{max-height:180px;overflow:auto;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#374151}
        .tp input[type=text]{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:13px 14px;font-size:16px;margin-top:10px}
        .tp label.c{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin-top:12px;line-height:1.4}
        .tp label.c input{margin-top:3px;width:18px;height:18px;accent-color:var(--a)}
        .tp-btn{display:block;width:100%;text-align:center;border:0;border-radius:14px;padding:15px;font-size:16px;font-weight:700;background:var(--a);color:var(--on);cursor:pointer;text-decoration:none}
        .tp-btn[disabled]{opacity:.5}
        .tp-btn.s{background:#fff;color:var(--ink);border:1px solid #d1d5db}
        .tp-btns{display:grid;gap:10px;margin-top:12px}
        .tp-link{color:var(--ink);font-weight:600;font-size:14px;text-decoration:none}
        .tp-bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:10px 16px calc(10px + env(safe-area-inset-bottom));display:none;z-index:5}
        @media(max-width:700px){.tp-bar.on{display:block}}
        .tp-err-t{color:#b91c1c;font-size:14px;margin:12px 0 0}
      `}</style>

      <header className="tp-top"><div className="tp-w">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : null}<b>{store.name}</b></div></header>
      <section className="tp-hero"><div className="tp-w">
        <span className="tp-chip">{accepted ? "Your booking" : "Trip proposal"} · {trip.reference}</span>
        <h1>{trip.title}</h1>
        <p>{trip.destination}{range(trip.departDate, trip.returnDate) ? ` · ${range(trip.departDate, trip.returnDate)}` : ""}</p>
      </div></section>

      <div className="tp-w">
        {trip.closed && <div className="tp-banner tp-err">This trip is {trip.status.toLowerCase()}. Please contact {store.name} if you have questions.</div>}
        {!trip.closed && trip.expired && <div className="tp-banner tp-warn">This proposal expired on {date(trip.validUntil)}. Please ask {store.name} for an updated one.</div>}
        {accepted && <div className="tp-banner tp-ok"><b>Accepted</b> by {trip.acceptedName} on {date(trip.acceptedAt)}.{m.balance > 0.004 ? " Pay below to secure your place." : " Your trip is fully paid."}</div>}
        {!accepted && !trip.closed && !trip.expired && trip.validUntil && <div className="tp-banner tp-warn">Valid until {date(trip.validUntil)}.</div>}

        <div className="tp-card"><h2>Hello {trip.clientFirstName}</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{trip.note || `Here are the details of your trip to ${trip.destination}. Review them, then accept the proposal to go ahead.`}</p>
        </div>

        {view.days.length > 0 && <div className="tp-card"><h2>Day by day</h2>{view.days.map((d) => <div className="tp-day" key={d.dayNumber}><i>{d.dayNumber}</i><div><b style={{ fontSize: 14 }}>{d.title}</b>{d.description && <p>{d.description}</p>}</div></div>)}</div>}

        {view.items.length > 0 && <div className="tp-card"><h2>What&apos;s included</h2>{view.items.map((it, i) => (
          <div className="tp-row" key={i}><div><b>{it.description}</b><small>{KIND[it.kind] ?? "Service"}{range(it.startDate, it.endDate) ? ` · ${range(it.startDate, it.endDate)}` : ""}</small>{it.flightLines.map((l, n) => <small key={n} style={{ color: "#374151" }}>{l}</small>)}</div><div>{it.sellPrice > 0 ? $(it.sellPrice) : ""}</div></div>
        ))}</div>}

        {view.travellers.length > 0 && <div className="tp-card"><h2>Travellers ({view.travellers.length})</h2><p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{view.travellers.join(" · ")}</p></div>}

        <div className="tp-card"><h2>Price</h2>
          <div className="tp-row"><span>Total</span><span className="tp-tot">{$(m.total)}</span></div>
          {m.paid > 0 && <div className="tp-row"><span>Paid</span><b>{$(m.paid)}</b></div>}
          {m.paid > 0 && <div className="tp-row"><span>Balance</span><b>{$(m.balance)}</b></div>}
          {view.schedule.length > 0 && <div style={{ marginTop: 10 }}>{view.schedule.map((s) => (
            <div className="tp-row" key={s.id}><div>{s.status === "RECEIVED" ? "Paid" : "Instalment"}<small>{s.status === "RECEIVED" ? date(s.paidAt) : `Due ${date(s.dueDate) ?? "—"}`}</small></div><div>{$(s.amount)}{s.status === "DUE" && s.dueDate && new Date(s.dueDate) < new Date() ? <small style={{ color: "#b91c1c" }}>Overdue</small> : null}</div></div>
          ))}</div>}
        </div>

        {canAccept && (
          <div className="tp-card"><h2>Accept this proposal</h2>
            {trip.terms && <div className="tp-terms" tabIndex={0} aria-label="Terms and conditions">{trip.terms}</div>}
            <input type="text" autoComplete="name" placeholder="Type your full name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your full name" />
            <label className="c"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I accept this proposal{trip.terms ? " and the terms above" : ""}, and agree to pay {$(m.total)} for {trip.title}.</span></label>
            {error && <p className="tp-err-t" role="alert">{error}</p>}
            <div className="tp-btns"><button className="tp-btn" disabled={pending || name.trim().length < 3 || !agree} onClick={accept}>{pending ? "Please wait…" : "Accept proposal"}</button></div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "10px 0 0" }}>Your name, the time and your network address are recorded as your acceptance.</p>
          </div>
        )}

        {accepted && view.payOptions.length > 0 && (
          <div className="tp-card"><h2>Pay online</h2>
            <div className="tp-btns">{view.payOptions.map((o, i) => <button key={o.id} className={`tp-btn${i === 0 ? "" : " s"}`} disabled={pending} onClick={() => pay(o.id)}>{pending ? "Please wait…" : `${o.label} · ${$(o.amount)}`}</button>)}</div>
            {error && <p className="tp-err-t" role="alert">{error}</p>}
          </div>
        )}
        {accepted && view.onlineError && m.balance > 0.004 && <div className="tp-banner tp-warn">Online payment isn&apos;t available for this trip. Please contact {store.name} to arrange payment.</div>}

        {(trip.departDate || view.items.some((i) => i.startDate)) && <div className="tp-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span style={{ fontSize: 14 }}>Keep your dates handy</span><a className="tp-link" href={`/api/store/${store.slug}/travel/proposal/${view.token}/calendar`}>Add to calendar</a></div>}

        {contact.length > 0 && <div className="tp-card"><h2>Questions?</h2><div style={{ display: "flex", gap: 16 }}>{contact.map((c) => <a key={c.label} className="tp-link" href={c.href}>{c.label} {store.name}</a>)}</div></div>}
      </div>

      {accepted && view.payOptions.length > 0 && (
        <div className="tp-bar on"><button className="tp-btn" disabled={pending} onClick={() => pay(view.payOptions[0].id)}>{view.payOptions[0].label} · {$(view.payOptions[0].amount)}</button></div>
      )}
    </main>
  );
}
