"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils/format-money";
import { whatsappLink } from "@/lib/travel";
import { AGING_BUCKETS } from "@/lib/travel-growth";
import * as A from "@/lib/actions/travel";
import * as G from "@/lib/actions/travel-growth";

type Data = NonNullable<Awaited<ReturnType<typeof A.getTravelDashboard>>>;
type Trip = Data["trips"][number];
type Pkg = Data["packages"][number];
type Run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string, after?: () => void) => void;
type Money = (n: unknown, c?: string) => string;

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50";
const btn2 = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50";
const card = "rounded-2xl border bg-card p-4";
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1 text-xs font-semibold text-muted-foreground">{label}{children}</label>;

const publicLink = (slug: string, token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/store/${slug}/travel/p/${token}`;

// ---------------------------------------------------------------- proposal link + acceptance

export function ProposalPanel({ slug, trip, data, pending, run }: { slug: string; trip: Trip; data: Data; pending: boolean; run: Run }) {
  const [note, setNote] = useState(trip.proposalNote ?? "");
  const [valid, setValid] = useState(trip.proposalValidUntil?.slice(0, 10) ?? "");
  const [terms, setTerms] = useState(trip.termsText ?? data.settings.termsText ?? "");
  const closed = ["COMPLETED", "CANCELLED"].includes(trip.status);
  const url = trip.shareToken ? publicLink(slug, trip.shareToken) : null;
  const wa = url ? whatsappLink(trip.client.phone, `Hi ${trip.client.fullName.split(" ")[0]}, here is your trip proposal for ${trip.title}. You can review it, accept and pay online: ${url}`) : null;
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Client proposal link</h3>
        {trip.acceptedAt
          ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">Accepted by {trip.acceptedName} · {fmtDate(trip.acceptedAt)}</span>
          : url ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Sent · waiting for acceptance</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">A private page with the itinerary, services, price and your terms. The client types their name to accept, then can pay the deposit or an instalment online. It never shows your costs, margin or suppliers.</p>
      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly className={`${inp} max-w-md`} value={url} onFocus={(e) => e.currentTarget.select()} />
          <button className={btn2} onClick={() => { void navigator.clipboard?.writeText(url); toast.success("Link copied"); }}>Copy</button>
          <a className={btn2} href={url} target="_blank" rel="noopener noreferrer">Preview</a>
          {wa && <a className={btn2} href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          <button className={btn2} disabled={pending} onClick={() => run(() => G.emailTravelProposal(slug, trip.id), "Proposal emailed")}>Email to client</button>
          <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Turn off this link? The client will no longer be able to open it. Their acceptance record stays.") && run(() => G.unshareTravelProposal(slug, trip.id), "Link turned off")}>Turn off</button>
        </div>
      )}
      {!closed && (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="md:col-span-2"><Field label="Message to the client (optional)"><textarea className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Great speaking with you. Here is the plan we discussed." /></Field></div>
          <Field label="Valid until (optional)"><input type="date" className={inp} value={valid} onChange={(e) => setValid(e.target.value)} /></Field>
          <div className="md:col-span-3"><Field label={trip.acceptedAt ? "Terms the client accepted (locked)" : "Terms and conditions (the client accepts these)"}><textarea className={inp} rows={4} value={terms} disabled={!!trip.acceptedAt} onChange={(e) => setTerms(e.target.value)} placeholder="Cancellation, refunds, visa responsibility… Set a default in the Settings tab." /></Field></div>
          <button className={`${btn} md:col-span-3`} disabled={pending} onClick={() => run(async () => {
            const r = await G.shareTravelProposal(slug, trip.id, { note, validUntil: valid, terms });
            if (r.success) toast.success(url ? "Proposal updated" : "Proposal link created");
            return r;
          })}>{url ? "Save changes" : "Create proposal link"}</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- instalment plan

export function InstalmentPanel({ slug, trip, pending, run, money }: { slug: string; trip: Trip; pending: boolean; run: Run; money: Money }) {
  const [f, setF] = useState({ count: "3", firstDue: "", intervalDays: "30" });
  const dues = trip.payments.filter((p) => p.status === "DUE");
  const closed = ["COMPLETED", "CANCELLED"].includes(trip.status);
  if (closed) return null;
  return (
    <div className={`${card} space-y-3`}>
      <h3 className="text-sm font-bold">Instalment plan</h3>
      <p className="text-xs text-muted-foreground">Splits the outstanding balance ({money(trip.money.balance, trip.currency)}) into scheduled instalments. The client gets an email reminder 3 days before, on the day, and weekly while overdue, with a link to pay. Online payments settle the oldest instalment first.</p>
      {dues.length > 0 && (
        <div className="text-sm">{dues.map((d) => <div key={d.id} className="flex justify-between border-b py-1 last:border-0"><span>{d.dueDate ? fmtDate(d.dueDate) : "No date"}</span><b>{money(d.amount, trip.currency)}</b></div>)}
          <button className={`${btn2} mt-2 text-red-600`} disabled={pending} onClick={() => confirm("Remove all unpaid scheduled instalments?") && run(() => G.clearTravelInstalmentPlan(slug, trip.id), "Plan removed")}>Remove plan</button></div>
      )}
      {trip.money.balance > 0 && (
        <div className="grid gap-2 md:grid-cols-4">
          <Field label="Instalments"><input type="number" min={1} max={24} className={inp} value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></Field>
          <Field label="First due"><input type="date" className={inp} value={f.firstDue} onChange={(e) => setF({ ...f, firstDue: e.target.value })} /></Field>
          <Field label="Days apart"><input type="number" min={1} max={365} className={inp} value={f.intervalDays} onChange={(e) => setF({ ...f, intervalDays: e.target.value })} /></Field>
          <div className="flex items-end"><button className={`${btn} w-full`} disabled={pending || !f.firstDue} onClick={() => run(() => G.createTravelInstalmentPlan(slug, trip.id, { count: Number(f.count), firstDue: f.firstDue, intervalDays: Number(f.intervalDays) }), dues.length ? "Plan replaced" : "Plan created")}>{dues.length ? "Replace plan" : "Create plan"}</button></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- supplier price in another currency

export type FxItemState = { costCurrency: string; costAmount: string; fxRate: string };

export function FxFields({ item, setItem, tripCurrency }: { item: FxItemState; setItem: (v: FxItemState) => void; tripCurrency: string }) {
  const [busy, setBusy] = useState(false);
  const on = !!item.costCurrency;
  async function live() {
    setBusy(true);
    try {
      const r = await fetch(`/api/fx?from=${encodeURIComponent(item.costCurrency)}&to=${encodeURIComponent(tripCurrency)}`);
      const j = await r.json();
      if (r.ok && j.rate) setItem({ ...item, fxRate: String(Math.round(j.rate * 10000) / 10000) }); else toast.error("Live rate unavailable. Enter the rate you were quoted.");
    } catch { toast.error("Live rate unavailable. Enter the rate you were quoted."); }
    setBusy(false);
  }
  return (
    <div className="md:col-span-6">
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={on} onChange={(e) => setItem(e.target.checked ? { ...item, costCurrency: tripCurrency === "USD" ? "GBP" : "USD" } : { costCurrency: "", costAmount: "", fxRate: "" })} />Supplier charges in another currency</label>
      {on && (
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <Field label="Currency"><input className={inp} maxLength={3} value={item.costCurrency} onChange={(e) => setItem({ ...item, costCurrency: e.target.value.toUpperCase() })} /></Field>
          <Field label={`Supplier price (${item.costCurrency || "…"})`}><input type="number" min={0} className={inp} value={item.costAmount} onChange={(e) => setItem({ ...item, costAmount: e.target.value })} /></Field>
          <Field label={`Rate (${tripCurrency} per 1 ${item.costCurrency || "…"})`}><input type="number" min={0} step="any" className={inp} value={item.fxRate} onChange={(e) => setItem({ ...item, fxRate: e.target.value })} /></Field>
          <div className="flex items-end gap-2"><button type="button" className={btn2} disabled={busy || item.costCurrency.length !== 3} onClick={live}>{busy ? "…" : "Use live rate"}</button>
            <span className="pb-2 text-xs text-muted-foreground">= {tripCurrency} {(Number(item.costAmount) * Number(item.fxRate) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
        </div>
      )}
      {on && <p className="mt-1 text-xs text-muted-foreground">The cost above is replaced by this converted amount. The rate is saved with the line so the cost never changes later.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- departures per package

export function DepartureManager({ slug, pkg, pending, run, money }: { slug: string; pkg: Pkg; pending: boolean; run: Run; money: Money }) {
  const blank = { id: "", departureDate: "", seats: "0", cutoffDays: "0", pricePerPerson: "" };
  const [f, setF] = useState(blank);
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="text-xs font-bold">More departure dates</div>
      <p className="text-xs text-muted-foreground">Each date has its own seats, price and booking cut-off. The date above is the main departure.</p>
      {pkg.departures.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div><b>{fmtDate(d.departureDate)}</b>{!d.isActive && <span className="ml-1 text-xs text-muted-foreground">(closed)</span>}
            <div className="text-xs text-muted-foreground">{d.seats ? `${d.booked}/${d.seats} seats` : pkg.seats ? `${d.booked}/${pkg.seats} seats` : `${d.booked} booked`}{d.cutoffDays ? ` · booking closes ${d.cutoffDays}d before` : ""}{d.pricePerPerson ? ` · ${money(d.pricePerPerson, pkg.currency)}` : ""}</div></div>
          <div className="flex gap-1">
            <button className={btn2} onClick={() => setF({ id: d.id, departureDate: d.departureDate.slice(0, 10), seats: String(d.seats), cutoffDays: String(d.cutoffDays), pricePerPerson: d.pricePerPerson ? String(d.pricePerPerson) : "" })}>Edit</button>
            <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Remove this departure? If it has bookings it is closed instead.") && run(async () => { const r = await G.removeTravelDeparture(slug, d.id); if (r.success) toast.success(r.data.closed ? "Departure closed (it has bookings)" : "Departure removed"); return r; })}>Remove</button>
          </div>
        </div>
      ))}
      <div className="grid gap-2 md:grid-cols-5">
        <input type="date" className={inp} value={f.departureDate} onChange={(e) => setF({ ...f, departureDate: e.target.value })} title="Departure date" />
        <input type="number" min={0} className={inp} placeholder="Seats (0 = package)" value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} />
        <input type="number" min={0} className={inp} placeholder="Cut-off days" value={f.cutoffDays} onChange={(e) => setF({ ...f, cutoffDays: e.target.value })} title="Online booking closes this many days before departure" />
        <input type="number" min={0} className={inp} placeholder="Price (optional)" value={f.pricePerPerson} onChange={(e) => setF({ ...f, pricePerPerson: e.target.value })} />
        <button className={btn} disabled={pending || !f.departureDate} onClick={() => run(() => G.saveTravelDeparture(slug, { id: f.id || undefined, packageId: pkg.id, departureDate: f.departureDate, seats: Number(f.seats), cutoffDays: Number(f.cutoffDays), pricePerPerson: f.pricePerPerson }), f.id ? "Departure saved" : "Departure added", () => setF(blank))}>{f.id ? "Save" : "Add date"}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- reports

type Reports = NonNullable<Awaited<ReturnType<typeof G.getTravelReports>>>;

export function ReportsTab({ slug }: { slug: string }) {
  const [r, setR] = useState<Reports | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; G.getTravelReports(slug).then((x) => { if (!live) return; if (x) setR(x); else setFailed(true); }).catch(() => live && setFailed(true)); return () => { live = false; }; }, [slug]);
  if (failed) return <div className={card}>Reports could not be loaded. Refresh the page and try again.</div>;
  if (!r) return <div className={card}>Loading reports…</div>;
  const m = (n: number, c: string) => formatMoney(n, c);
  const exp = (kind: string, label: string) => <a key={kind} className={btn2} href={`/api/store/${slug}/travel/export?kind=${kind}`}>{label}</a>;
  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <b className="mr-2 text-sm">Download for your accountant (CSV)</b>
        {exp("profit", "Profit per trip")}{exp("receivables", "Instalments owed")}{exp("payments", "Payments received")}
        <span className="text-xs text-muted-foreground">Opens in Excel or Google Sheets and imports into Xero or QuickBooks. There is no live sync.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {r.totals.map((t) => (
          <div key={t.currency} className={card}>
            <h3 className="mb-2 text-sm font-bold">Confirmed trips · {t.currency} ({t.trips})</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>Sales</span><b className="text-right">{m(t.price, t.currency)}</b>
              <span>Supplier cost</span><b className="text-right">{m(t.cost, t.currency)}</b>
              <span>Agent commission</span><b className="text-right">{m(t.commission, t.currency)}</b>
              <span className="font-bold">Profit</span><b className="text-right">{m(t.profit, t.currency)}</b>
              <span>Collected</span><b className="text-right">{m(t.paid, t.currency)}</b>
              <span>Still to collect</span><b className="text-right">{m(t.balance, t.currency)}</b>
            </div>
          </div>
        ))}
        {!r.totals.length && <div className={card}>No confirmed trips yet. Profit appears once a trip is confirmed.</div>}
      </div>

      <div className={card}>
        <h3 className="mb-3 text-sm font-bold">Instalments owed, by age</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {AGING_BUCKETS.map((b) => { const x = r.aging.find((a) => a.bucket === b)!; return (
            <div key={b} className="rounded-xl bg-muted/50 p-3 text-center"><div className="text-[11px] font-semibold text-muted-foreground">{b === "CURRENT" ? "Not yet due" : `${b} days late`}</div><div className="text-lg font-bold">{x.count}</div>
              <div className="text-[11px] text-muted-foreground">{x.amounts.map((a) => m(a.amount, a.currency)).join(" · ") || "—"}</div></div>); })}
        </div>
        <div className="mt-3 max-h-72 overflow-auto">
          {r.receivables.map((x) => {
            const wa = whatsappLink(x.phone, `Hi ${x.client.split(" ")[0]}, a friendly reminder that ${m(x.amount, x.currency)} for your trip (${x.reference}) ${x.daysOverdue > 0 ? "was due on" : "is due on"} ${fmtDate(x.dueDate)}.`);
            return (
              <div key={x.paymentId} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
                <div><b>{x.client}</b> · {x.reference}<div className="text-xs text-muted-foreground">Due {fmtDate(x.dueDate)}{x.daysOverdue > 0 ? ` · ${x.daysOverdue} days late` : ""}</div></div>
                <div className="flex items-center gap-2"><b>{m(x.amount, x.currency)}</b>{wa && <a className={btn2} href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</div>
              </div>);
          })}
          {!r.receivables.length && <p className="text-sm text-muted-foreground">No scheduled instalments are waiting. Create an instalment plan on a trip to track them here.</p>}
        </div>
      </div>

      {r.byDestination.length > 0 && (
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold">Best destinations by profit</h3>
          {r.byDestination.map((d) => <div key={`${d.destination}${d.currency}`} className="flex justify-between border-b py-1.5 text-sm last:border-0"><span>{d.destination} <span className="text-xs text-muted-foreground">({d.trips} trip{d.trips === 1 ? "" : "s"})</span></span><b>{m(d.profit, d.currency)}</b></div>)}
        </div>
      )}

      <div className={card}>
        <h3 className="mb-2 text-sm font-bold">Profit per trip</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1">Trip</th><th>Price</th><th>Cost</th><th>Commission</th><th>Profit</th><th>Margin</th><th>Balance</th></tr></thead>
            <tbody>{r.rows.slice(0, 100).map((x) => (
              <tr key={x.id} className="border-t"><td className="py-1.5"><b>{x.reference}</b> <span className="text-xs text-muted-foreground">{x.client}</span></td><td>{m(x.price, x.currency)}</td><td>{m(x.cost, x.currency)}</td><td>{m(x.commission, x.currency)}</td>
                <td className={x.profit < 0 ? "font-bold text-red-600" : "font-bold"}>{m(x.profit, x.currency)}</td><td>{x.marginPct === null ? "—" : `${x.marginPct}%`}</td><td>{m(x.balance, x.currency)}</td></tr>))}</tbody>
          </table>
        </div>
        {r.rows.length > 100 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 100. Download the CSV for all {r.rows.length}.</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- settings: terms, reminders, partner API, calendar

export function SettingsTab({ slug, data, pending, run }: { slug: string; data: Data; pending: boolean; run: Run }) {
  const s = data.settings;
  const [terms, setTerms] = useState(s.termsText);
  const [reminders, setReminders] = useState(s.remindersEnabled);
  const [review, setReview] = useState(s.reviewUrl);
  const [newKey, setNewKey] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const feed = `${origin}/api/store/${slug}/travel/calendar`;
  const api = `${origin}/api/store/${slug}/travel/partner`;
  const copy = (v: string) => { void navigator.clipboard?.writeText(v); toast.success("Copied"); };
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <h3 className="text-sm font-bold">Proposals, reminders and follow-up</h3>
        <Field label="Default terms and conditions (copied onto each new proposal)"><textarea className={inp} rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Deposit, payment deadlines, cancellation and refund policy, visa and passport responsibility…" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />Email clients automatically about instalments that are due or overdue</label>
        <Field label="Review link for the thank-you email sent after a completed trip (Google, Facebook…)"><input className={inp} placeholder="https://g.page/r/…" value={review} onChange={(e) => setReview(e.target.value)} /></Field>
        <button className={btn} disabled={pending} onClick={() => run(() => G.saveTravelSettings(slug, { termsText: terms, remindersEnabled: reminders, reviewUrl: review }), "Settings saved")}>Save settings</button>
      </div>

      <div className={`${card} space-y-2`}>
        <h3 className="text-sm font-bold">Departures calendar</h3>
        <p className="text-xs text-muted-foreground">Subscribe in Google, Apple or Outlook calendar to see every open departure. Names, destinations and dates only.</p>
        <div className="flex flex-wrap gap-2"><input readOnly className={`${inp} max-w-xl`} value={feed} onFocus={(e) => e.currentTarget.select()} /><button className={btn2} onClick={() => copy(feed)}>Copy</button></div>
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className="text-sm font-bold">Partner feed (API)</h3>
        <p className="text-xs text-muted-foreground">A read-only JSON list of your bookable departures with live seats, price and deposit, for resellers, comparison sites or your own website. Partners send customers to your booking page; payment and seat checks stay with you. This is not a connection to Viator, Bókun or other marketplaces.</p>
        <div className="flex flex-wrap items-center gap-2"><input readOnly className={`${inp} max-w-xl`} value={api} onFocus={(e) => e.currentTarget.select()} /><button className={btn2} onClick={() => copy(api)}>Copy</button></div>
        <p className="text-xs text-muted-foreground">Send the header <code>Authorization: Bearer YOUR_KEY</code>. {s.hasPartnerKey ? `A key ending in ${s.partnerKeyHint} is active.` : "No key yet."}</p>
        {newKey && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><b>Copy this key now. It will not be shown again.</b><div className="mt-1 break-all font-mono text-xs">{newKey}</div><button className={`${btn2} mt-2`} onClick={() => copy(newKey)}>Copy key</button></div>}
        <div className="flex gap-2">
          <button className={btn} disabled={pending} onClick={() => { if (s.hasPartnerKey && !confirm("Creating a new key stops the old one working. Continue?")) return; run(async () => { const r = await G.rotateTravelPartnerKey(slug); if (r.success) setNewKey(r.data.key); return r; }); }}>{s.hasPartnerKey ? "Replace key" : "Create key"}</button>
          {s.hasPartnerKey && <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Revoke the key? Partners using it will stop receiving data.") && run(() => G.revokeTravelPartnerKey(slug), "Key revoked", () => setNewKey(null))}>Revoke</button>}
        </div>
      </div>
    </section>
  );
}
