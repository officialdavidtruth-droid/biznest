"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils/format-money";
import {
  TRIP_STATUSES, TRIP_STATUS_LABEL, ITEM_KINDS, PAYMENT_METHODS, SUPPLIER_KINDS, VISA_STATUSES, VISA_STATUS_LABEL, VISA_TYPES,
  daysUntil, passportWarning, type TripStatus,
} from "@/lib/travel";
import * as A from "@/lib/actions/travel";

type Data = NonNullable<Awaited<ReturnType<typeof A.getTravelDashboard>>>;
type Trip = Data["trips"][number];
type Tab = "overview" | "trips" | "clients" | "packages" | "visas" | "suppliers";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "trips", label: "Trips" }, { id: "clients", label: "Clients" },
  { id: "packages", label: "Packages" }, { id: "visas", label: "Visas" }, { id: "suppliers", label: "Suppliers" },
];
const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50";
const btn2 = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50";
const card = "rounded-2xl border bg-card p-4";
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const dateInput = (d: string | null | undefined) => (d ? d.slice(0, 10) : "");
const STATUS_TONE: Record<string, string> = {
  ENQUIRY: "bg-slate-100 text-slate-700", QUOTED: "bg-amber-100 text-amber-800", CONFIRMED: "bg-blue-100 text-blue-800",
  TICKETED: "bg-indigo-100 text-indigo-800", TRAVELLING: "bg-emerald-100 text-emerald-800", COMPLETED: "bg-green-100 text-green-800", CANCELLED: "bg-red-100 text-red-700",
};

export function TravelWorkspace({ slug, data }: { slug: string; data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [tripId, setTripId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | TripStatus>("OPEN");
  const [q, setQ] = useState("");
  const money = (n: unknown, c?: string) => formatMoney(n, c ?? data.currency, { locale: data.locale });

  /** Run an action, toast the outcome and refresh server data. */
  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok?: string, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.success) { toast.error(r.error || "Something went wrong."); return; }
      if (ok) toast.success(ok);
      after?.();
      router.refresh();
    });
  }

  const trip = data.trips.find((t) => t.id === tripId) ?? null;
  const visibleTrips = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.trips.filter((t) => {
      if (filter === "OPEN" && ["COMPLETED", "CANCELLED"].includes(t.status)) return false;
      if (filter !== "OPEN" && filter !== "ALL" && t.status !== filter) return false;
      if (!needle) return true;
      return [t.reference, t.title, t.destination, t.client.fullName].some((x) => x.toLowerCase().includes(needle));
    });
  }, [data.trips, filter, q]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">BizNest Travel</h1>
        <p className="text-sm text-muted-foreground">Enquiries to ticketing: clients, trips, payments, visas, suppliers and group packages in one place.</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "trips") setTripId(null); }} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t.label}</button>
        ))}
      </nav>

      {tab === "overview" && <Overview data={data} money={money} openTrip={(id) => { setTab("trips"); setTripId(id); }} />}

      {tab === "trips" && !trip && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, client, destination" className={`${inp} max-w-xs`} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className={`${inp} max-w-[11rem]`}>
              <option value="OPEN">Open trips</option><option value="ALL">All trips</option>
              {TRIP_STATUSES.map((s) => <option key={s} value={s}>{TRIP_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <NewTripForm data={data} pending={pending} onCreate={(v) => run(async () => { const r = await A.createTravelTrip(slug, v); if (r.success) setTripId(r.data.id); return r; }, "Trip created")} />
          <div className="grid gap-2">
            {visibleTrips.map((t) => <TripRow key={t.id} t={t} money={money} onOpen={() => setTripId(t.id)} />)}
            {!visibleTrips.length && <Empty text="No trips match. Create one above." />}
          </div>
        </section>
      )}
      {tab === "trips" && trip && <TripDetail key={trip.id} slug={slug} trip={trip} data={data} money={money} pending={pending} run={run} back={() => setTripId(null)} start={start} />}

      {tab === "clients" && <Clients slug={slug} data={data} pending={pending} run={run} />}
      {tab === "packages" && <Packages slug={slug} data={data} pending={pending} run={run} money={money} />}
      {tab === "visas" && <Visas slug={slug} data={data} pending={pending} run={run} money={money} />}
      {tab === "suppliers" && <Suppliers slug={slug} data={data} pending={pending} run={run} />}
    </div>
  );
}

type Run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string, after?: () => void) => void;
const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
const Badge = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[s] ?? "bg-muted text-foreground"}`}>{TRIP_STATUS_LABEL[s as TripStatus] ?? s}</span>;
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1 text-xs font-semibold text-muted-foreground">{label}{children}</label>;

function Overview({ data, money, openTrip }: { data: Data; money: (n: unknown, c?: string) => string; openTrip: (id: string) => void }) {
  const s = data.stats;
  const stat = (label: string, value: string | number, hint?: string) => <div className={card}><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>;
  const departing = data.trips.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status) && t.departDate && (daysUntil(t.departDate) ?? -1) >= 0).sort((a, b) => +new Date(a.departDate!) - +new Date(b.departDate!)).slice(0, 6);
  const pipeline = TRIP_STATUSES.filter((x) => x !== "CANCELLED").map((st) => ({ st, n: data.trips.filter((t) => t.status === st).length }));
  const alerts = data.trips.flatMap((t) => ["CANCELLED", "COMPLETED"].includes(t.status) ? [] : t.travellers.map((tr) => ({ t, tr, w: passportWarning(tr.passportExpiry, t.departDate) })).filter((x) => x.w));
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Open trips", s.openTrips)}{stat("Enquiries & quotes", s.enquiries, "to follow up")}
        {stat("Departing in 14 days", s.departingSoon)}{stat("Outstanding balances", money(s.outstanding), "confirmed trips")}
        {stat("Booked revenue", money(s.revenue))}{stat("Gross margin", money(s.margin))}
        {stat("Open visa cases", s.openVisas)}{stat("Overdue instalments", data.overduePayments.length)}
      </div>
      <div className={card}>
        <h2 className="mb-3 text-sm font-bold">Pipeline</h2>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">{pipeline.map((p) => <div key={p.st} className="rounded-xl bg-muted/50 p-3 text-center"><div className="text-xl font-bold">{p.n}</div><div className="text-[11px] text-muted-foreground">{TRIP_STATUS_LABEL[p.st]}</div></div>)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h2 className="mb-2 text-sm font-bold">Upcoming departures</h2>
          {departing.length ? departing.map((t) => <button key={t.id} onClick={() => openTrip(t.id)} className="flex w-full items-center justify-between border-b py-2 text-left text-sm last:border-0"><span><b>{t.destination}</b> · {t.client.fullName}</span><span className="text-xs text-muted-foreground">{fmtDate(t.departDate)} ({daysUntil(t.departDate)}d)</span></button>) : <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
        </div>
        <div className={card}>
          <h2 className="mb-2 text-sm font-bold">Needs attention</h2>
          {data.overduePayments.map((p) => <button key={p.id} onClick={() => openTrip(p.tripId)} className="flex w-full justify-between border-b py-2 text-left text-sm"><span>{p.client} · {p.reference}</span><span className="text-xs font-semibold text-red-600">{money(p.amount, p.currency)} due {fmtDate(p.dueDate)}</span></button>)}
          {alerts.slice(0, 8).map(({ t, tr, w }) => <button key={tr.id} onClick={() => openTrip(t.id)} className="flex w-full justify-between border-b py-2 text-left text-sm"><span>{tr.fullName} · {t.reference}</span><span className="text-xs font-semibold text-amber-700">{w}</span></button>)}
          {!data.overduePayments.length && !alerts.length && <p className="text-sm text-muted-foreground">All clear.</p>}
        </div>
      </div>
    </section>
  );
}

function TripRow({ t, money, onOpen }: { t: Trip; money: (n: unknown, c?: string) => string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className={`${card} flex flex-wrap items-center justify-between gap-2 text-left hover:border-primary`}>
      <div><div className="flex items-center gap-2"><span className="font-semibold">{t.destination}</span><Badge s={t.status} /></div><div className="text-xs text-muted-foreground">{t.reference} · {t.client.fullName} · {t.travellers.length} traveller(s) · {fmtDate(t.departDate)}</div></div>
      <div className="text-right text-sm"><div className="font-bold">{money(t.money.total, t.currency)}</div><div className={`text-xs ${t.money.balance > 0 ? "text-amber-700" : "text-green-700"}`}>{t.money.balance > 0 ? `${money(t.money.balance, t.currency)} owing` : t.money.total > 0 ? "Paid in full" : "No price yet"}</div></div>
    </button>
  );
}

function NewTripForm({ data, pending, onCreate }: { data: Data; pending: boolean; onCreate: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ clientId: "", destination: "", title: "", departDate: "", returnDate: "", packageId: "", travellerCount: 1, totalPrice: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  if (!open) return <button className={btn} onClick={() => setOpen(true)}>+ New trip</button>;
  const pkgs = data.packages.filter((p) => p.isActive);
  return (
    <div className={`${card} space-y-3`}>
      {!data.clients.length && <p className="text-sm text-amber-700">Add a client first (Clients tab).</p>}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Client"><select className={inp} value={f.clientId} onChange={(e) => set("clientId", e.target.value)}><option value="">Select…</option>{data.clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}</select></Field>
        <Field label="Group package (optional)"><select className={inp} value={f.packageId} onChange={(e) => { const p = pkgs.find((x) => x.id === e.target.value); setF((s) => ({ ...s, packageId: e.target.value, destination: p ? p.destination : s.destination, title: p ? p.name : s.title })); }}><option value="">None — custom trip</option>{pkgs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.seats ? ` (${Math.max(0, p.seats - p.booked)} seats left)` : ""}</option>)}</select></Field>
        <Field label="Destination"><input className={inp} value={f.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
        <Field label="Trip title"><input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Dubai family holiday" /></Field>
        <Field label="Depart"><input type="date" className={inp} value={f.departDate} onChange={(e) => set("departDate", e.target.value)} /></Field>
        <Field label="Return"><input type="date" className={inp} value={f.returnDate} onChange={(e) => set("returnDate", e.target.value)} /></Field>
        <Field label="Travellers"><input type="number" min={1} max={60} className={inp} value={f.travellerCount} onChange={(e) => set("travellerCount", Number(e.target.value))} /></Field>
        <Field label="Quoted price (optional)"><input type="number" min={0} className={inp} value={f.totalPrice} onChange={(e) => set("totalPrice", e.target.value)} /></Field>
      </div>
      <div className="flex gap-2"><button disabled={pending} className={btn} onClick={() => { onCreate({ ...f, totalPrice: f.totalPrice === "" ? undefined : Number(f.totalPrice) }); setOpen(false); }}>Create trip</button><button className={btn2} onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  );
}

function TripDetail({ slug, trip, data, money, pending, run, back, start }: { start: (fn: () => void) => void; slug: string; trip: Trip; data: Data; money: (n: unknown, c?: string) => string; pending: boolean; run: Run; back: () => void }) {
  const m = trip.money;
  const closed = ["COMPLETED", "CANCELLED"].includes(trip.status);
  const [item, setItem] = useState({ kind: "FLIGHT", description: "", supplierId: "", costPrice: "", sellPrice: "", confirmationRef: "", startDate: "", endDate: "" });
  const [pay, setPay] = useState({ amount: "", method: "TRANSFER", reference: "", dueDate: "" });
  const [trav, setTrav] = useState({ fullName: "", passportNo: "", passportExpiry: "" });
  const [price, setPrice] = useState(String(m.total));
  const [refund, setRefund] = useState<{ id: string; amount: string; reason: string } | null>(null);
  const next = TRIP_STATUSES.filter((s) => s !== trip.status && s !== "CANCELLED");
  return (
    <section className="space-y-4">
      <button className={btn2} onClick={back}>← All trips</button>
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold">{trip.title}</h2><p className="text-sm text-muted-foreground">{trip.reference} · {trip.client.fullName}{trip.client.phone ? ` · ${trip.client.phone}` : ""} · {fmtDate(trip.departDate)} → {fmtDate(trip.returnDate)}</p></div>
          <Badge s={trip.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([["quote", "Quote PDF"], ["invoice", "Invoice PDF"], ["itinerary", "Itinerary PDF"]] as const).map(([type, label]) => (
            <a key={type} className={btn2} href={`/api/store/${slug}/travel/${trip.id}/document?type=${type}`} target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
        </div>
        {!closed && (
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inp} max-w-[12rem]`} value="" disabled={pending} onChange={(e) => e.target.value && run(() => A.setTravelTripStatus(slug, trip.id, e.target.value), "Status updated")}>
              <option value="">Move to…</option>{next.map((s) => <option key={s} value={s}>{TRIP_STATUS_LABEL[s]}</option>)}
            </select>
            <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Cancel this trip?") && run(() => A.setTravelTripStatus(slug, trip.id, "CANCELLED"), "Trip cancelled")}>Cancel trip</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Price", money(m.total, trip.currency)], ["Paid", money(m.paid, trip.currency)], ...(m.refunded > 0 ? [["Refunded", money(m.refunded, trip.currency)]] : []), ["Balance", money(m.balance, trip.currency)], ["Cost", money(m.cost, trip.currency)], ["Margin", money(m.margin, trip.currency)]].map(([k, v]) => <div key={k} className="rounded-xl bg-muted/50 p-3"><div className="text-[11px] text-muted-foreground">{k}</div><div className="font-bold">{v}</div></div>)}
        </div>
        {!closed && !trip.items.length && (
          <div className="flex items-end gap-2"><Field label="Set price (when no service lines)"><input type="number" min={0} className={inp} value={price} onChange={(e) => setPrice(e.target.value)} /></Field><button className={btn} disabled={pending} onClick={() => run(() => A.updateTravelTrip(slug, trip.id, { totalPrice: Number(price) }), "Price saved")}>Save</button></div>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-sm font-bold">Services</h3>
        {trip.items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
            <div><b>{i.kind}</b> · {i.description}<div className="text-xs text-muted-foreground">{i.startDate ? `${fmtDate(i.startDate)}${i.endDate ? ` → ${fmtDate(i.endDate)}` : ""} · ` : ""}{i.supplierName ?? "No supplier"}{i.confirmationRef ? ` · Ref ${i.confirmationRef}` : ""} · {i.status}</div></div>
            <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">cost {money(i.costPrice, trip.currency)}</span><b>{money(i.sellPrice, trip.currency)}</b>
              {!closed && i.status !== "CONFIRMED" && <button className={btn2} disabled={pending} onClick={() => run(() => A.saveTravelItem(slug, trip.id, { id: i.id, kind: i.kind, description: i.description, supplierId: i.supplierId ?? undefined, confirmationRef: i.confirmationRef ?? undefined, startDate: i.startDate ? i.startDate.slice(0, 10) : undefined, endDate: i.endDate ? i.endDate.slice(0, 10) : undefined, status: "CONFIRMED", costPrice: i.costPrice, sellPrice: i.sellPrice }), "Marked confirmed")}>Confirm</button>}
              {!closed && <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => run(() => A.removeTravelItem(slug, trip.id, i.id))}>Remove</button>}</div>
          </div>
        ))}
        {!trip.items.length && <p className="text-sm text-muted-foreground">No service lines yet. Adding lines makes the trip price and cost calculate automatically.</p>}
        {!closed && (
          <div className="mt-3 grid gap-2 md:grid-cols-6">
            <select className={inp} value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value })}>{ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input className={`${inp} md:col-span-2`} placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
            <select className={inp} value={item.supplierId} onChange={(e) => setItem({ ...item, supplierId: e.target.value })}><option value="">Supplier…</option>{data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input type="number" min={0} className={inp} placeholder="Cost" value={item.costPrice} onChange={(e) => setItem({ ...item, costPrice: e.target.value })} />
            <input type="number" min={0} className={inp} placeholder="Sell" value={item.sellPrice} onChange={(e) => setItem({ ...item, sellPrice: e.target.value })} />
            <label className="text-xs text-muted-foreground md:col-span-3">Start date (for the itinerary)<input type="date" className={`${inp} mt-1`} value={item.startDate} onChange={(e) => setItem({ ...item, startDate: e.target.value })} /></label>
            <label className="text-xs text-muted-foreground md:col-span-3">End date (optional)<input type="date" className={`${inp} mt-1`} value={item.endDate} onChange={(e) => setItem({ ...item, endDate: e.target.value })} /></label>
            <button className={`${btn} md:col-span-6`} disabled={pending} onClick={() => run(() => A.saveTravelItem(slug, trip.id, { ...item, supplierId: item.supplierId || undefined, confirmationRef: item.confirmationRef || undefined, startDate: item.startDate || undefined, endDate: item.endDate || undefined, costPrice: Number(item.costPrice || 0), sellPrice: Number(item.sellPrice || 0) }), "Service added", () => setItem({ ...item, description: "", costPrice: "", sellPrice: "", startDate: "", endDate: "" }))}>Add service</button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold">Payments</h3>
          {trip.payments.filter((p) => p.status !== "VOID").map((p) => {
            const refunded = p.refundedAmount > 0;
            const canRefund = p.status === "RECEIVED" && !refunded;
            const open = refund && refund.id === p.id ? refund : null;
            return (
              <div key={p.id} className="border-b py-2 text-sm last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div><b>{money(p.amount, trip.currency)}</b> <span className={`text-xs ${p.status === "DUE" ? "text-amber-700" : "text-green-700"}`}>{p.status === "DUE" ? `due ${fmtDate(p.dueDate)}` : `received ${fmtDate(p.paidAt)}`}</span>
                    {refunded && <span className="ml-1 text-xs font-semibold text-red-600">{p.status === "REFUNDED" ? "fully refunded" : `${money(p.refundedAmount, trip.currency)} refunded`}</span>}
                    <div className="text-xs text-muted-foreground">{p.method}{p.reference ? ` · ${p.reference}` : ""}{refunded && p.refundReason ? ` · ${p.refundReason}` : ""}</div></div>
                  <div className="flex gap-1">
                    {p.status === "DUE" && <button className={btn2} disabled={pending} onClick={() => run(() => A.markTravelPaymentReceived(slug, trip.id, p.id, { method: "TRANSFER" }), "Payment recorded")}>Mark paid</button>}
                    {canRefund && <button className={btn2} disabled={pending} onClick={() => setRefund(open ? null : { id: p.id, amount: String(p.amount), reason: "" })}>Refund</button>}
                    {p.status !== "REFUNDED" && !refunded && <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Void this payment? Use Refund instead if the money was actually received.") && run(() => A.voidTravelPayment(slug, trip.id, p.id))}>Void</button>}
                  </div>
                </div>
                {open && (
                  <div className="mt-2 grid gap-2 rounded-lg bg-muted/50 p-3 md:grid-cols-3">
                    <Field label={`Refund amount (max ${money(p.amount, trip.currency)})`}><input type="number" min={0} max={p.amount} className={inp} value={open.amount} onChange={(e) => setRefund({ ...open, amount: e.target.value })} /></Field>
                    <div className="md:col-span-2"><Field label="Reason (kept on the record)"><input className={inp} placeholder="e.g. Trip cancelled, visa refused" value={open.reason} onChange={(e) => setRefund({ ...open, reason: e.target.value })} /></Field></div>
                    <p className="text-xs text-muted-foreground md:col-span-3">Refund less than the full amount to keep a cancellation fee. Only one refund can be made per payment. Payments taken online go back to the traveller through the gateway; for cash or transfers BizNest only records the refund, so you repay the traveller yourself.</p>
                    <div className="flex gap-2 md:col-span-3">
                      <button className={btn} disabled={pending || !(Number(open.amount) > 0) || open.reason.trim().length < 3} onClick={() => {
                        if (!confirm(`Refund ${money(Number(open.amount), trip.currency)} to the traveller? This can't be undone.`)) return;
                        run(async () => {
                          const r = await A.requestTravelRefund(slug, trip.id, p.id, { amount: Number(open.amount), reason: open.reason });
                          if (r.success) toast.success(r.data.mode === "gateway" ? "Refund sent through the payment gateway." : "Refund recorded. Repay the traveller yourself, BizNest did not move any money.");
                          return r;
                        }, undefined, () => setRefund(null));
                      }}>Confirm refund</button>
                      <button className={btn2} onClick={() => setRefund(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!trip.payments.some((p) => p.status !== "VOID") && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          {trip.status !== "CANCELLED" && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input type="number" min={0} className={inp} placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              <select className={inp} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{PAYMENT_METHODS.map((k) => <option key={k}>{k}</option>)}</select>
              <input className={inp} placeholder="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
              <input type="date" className={inp} value={pay.dueDate} onChange={(e) => setPay({ ...pay, dueDate: e.target.value })} title="Due date (for instalments)" />
              <button className={btn} disabled={pending} onClick={() => run(() => A.recordTravelPayment(slug, trip.id, { amount: Number(pay.amount), method: pay.method, reference: pay.reference }), "Payment recorded", () => setPay({ ...pay, amount: "", reference: "" }))}>Record received</button>
              <button className={btn2} disabled={pending} onClick={() => run(() => A.recordTravelPayment(slug, trip.id, { amount: Number(pay.amount), method: pay.method, dueDate: pay.dueDate, scheduleOnly: true }), "Instalment scheduled", () => setPay({ ...pay, amount: "", dueDate: "" }))}>Schedule instalment</button>
              {trip.currency === "NGN" && <button className={`${btn2} md:col-span-2`} disabled={pending} onClick={() => start(async () => { const r = await A.createTravelPaymentLink(slug, trip.id, Number(pay.amount)); if (!r.success) { toast.error(r.error); return; } try { await navigator.clipboard.writeText(r.data.url); toast.success("Payment link copied. Send it to the traveller."); } catch { window.prompt("Copy this payment link", r.data.url); } })}>Create online payment link for this amount</button>}
            </div>
          )}
        </div>
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold">Travellers</h3>
          {trip.travellers.map((t) => { const w = passportWarning(t.passportExpiry, trip.departDate); return (
            <div key={t.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
              <div><b>{t.fullName}</b>{t.isLead ? " (lead)" : ""}<div className="text-xs text-muted-foreground">{t.passportNo || "No passport on file"}{t.passportExpiry ? ` · exp ${fmtDate(t.passportExpiry)}` : ""}</div>{w && <div className="text-xs font-semibold text-amber-700">⚠ {w}</div>}</div>
              {!closed && trip.travellers.length > 1 && <button className={`${btn2} text-red-600`} disabled={pending} onClick={() => run(() => A.removeTravelTraveler(slug, trip.id, t.id))}>Remove</button>}
            </div>); })}
          {!closed && (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input className={inp} placeholder="Full name" value={trav.fullName} onChange={(e) => setTrav({ ...trav, fullName: e.target.value })} />
              <input className={inp} placeholder="Passport no." value={trav.passportNo} onChange={(e) => setTrav({ ...trav, passportNo: e.target.value })} />
              <input type="date" className={inp} value={trav.passportExpiry} onChange={(e) => setTrav({ ...trav, passportExpiry: e.target.value })} title="Passport expiry" />
              <button className={`${btn} md:col-span-3`} disabled={pending} onClick={() => run(() => A.saveTravelTraveler(slug, trip.id, trav), "Traveller added", () => setTrav({ fullName: "", passportNo: "", passportExpiry: "" }))}>Add traveller</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Clients({ slug, data, pending, run }: { slug: string; data: Data; pending: boolean; run: Run }) {
  const blank = { id: "", fullName: "", email: "", phone: "", nationality: "", passportNo: "", passportExpiry: "" };
  const [f, setF] = useState(blank);
  const [q, setQ] = useState("");
  const list = data.clients.filter((c) => !q || [c.fullName, c.phone ?? "", c.email ?? "", c.passportNo ?? ""].some((x) => x.toLowerCase().includes(q.toLowerCase())));
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-bold">{f.id ? "Edit client" : "Add client"}</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {([["fullName", "Full name (as on passport)"], ["phone", "Phone"], ["email", "Email"], ["nationality", "Nationality"], ["passportNo", "Passport number"]] as const).map(([k, l]) => <input key={k} className={inp} placeholder={l} value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <input type="date" className={inp} value={f.passportExpiry} onChange={(e) => setF({ ...f, passportExpiry: e.target.value })} title="Passport expiry" />
        </div>
        <div className="flex gap-2"><button className={btn} disabled={pending} onClick={() => run(() => A.saveTravelClient(slug, { ...f, id: f.id || undefined }), "Client saved", () => setF(blank))}>Save client</button>{f.id && <button className={btn2} onClick={() => setF(blank)}>Cancel</button>}</div>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={`${inp} max-w-xs`} />
      <div className="grid gap-2">
        {list.map((c) => (
          <div key={c.id} className={`${card} flex items-center justify-between gap-2`}>
            <div><b>{c.fullName}</b><div className="text-xs text-muted-foreground">{[c.phone, c.email, c.nationality, c.passportNo && `Passport ${c.passportNo}`].filter(Boolean).join(" · ") || "No contact details"} · {c.tripCount} trip(s)</div>{passportWarning(c.passportExpiry, null) && <div className="text-xs font-semibold text-amber-700">⚠ {passportWarning(c.passportExpiry, null)}</div>}</div>
            <button className={btn2} onClick={() => setF({ id: c.id, fullName: c.fullName, email: c.email ?? "", phone: c.phone ?? "", nationality: c.nationality ?? "", passportNo: c.passportNo ?? "", passportExpiry: dateInput(c.passportExpiry) })}>Edit</button>
          </div>
        ))}
        {!list.length && <Empty text="No clients yet." />}
      </div>
    </section>
  );
}

function Packages({ slug, data, pending, run, money }: { slug: string; data: Data; pending: boolean; run: Run; money: (n: unknown, c?: string) => string }) {
  const blank = { id: "", name: "", destination: "", durationDays: 7, pricePerPerson: "", departureDate: "", seats: 0, depositPercent: 30, inclusions: "", isActive: true };
  const [f, setF] = useState(blank);
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-bold">{f.id ? "Edit package" : "New group package"}</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={inp} placeholder="Package name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={inp} placeholder="Destination" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
          <input type="number" min={1} className={inp} placeholder="Days" value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: Number(e.target.value) })} />
          <input type="number" min={0} className={inp} placeholder="Price per person" value={f.pricePerPerson} onChange={(e) => setF({ ...f, pricePerPerson: e.target.value })} />
          <input type="date" className={inp} value={f.departureDate} onChange={(e) => setF({ ...f, departureDate: e.target.value })} title="Departure" />
          <input type="number" min={0} className={inp} placeholder="Seats (0 = unlimited)" value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm md:col-span-3">Deposit to book online <input type="number" min={0} max={100} className={`${inp} max-w-[6rem]`} value={f.depositPercent} onChange={(e) => setF({ ...f, depositPercent: Number(e.target.value) })} /> % of the price (0 = enquiry only, 100 = pay in full)</label>
          <textarea className={`${inp} md:col-span-3`} placeholder="What's included" value={f.inclusions} onChange={(e) => setF({ ...f, inclusions: e.target.value })} />
        </div>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Open for booking</label>
          <button className={btn} disabled={pending} onClick={() => run(() => A.saveTravelPackage(slug, { ...f, id: f.id || undefined, pricePerPerson: Number(f.pricePerPerson) }), "Package saved", () => setF(blank))}>Save package</button>{f.id && <button className={btn2} onClick={() => setF(blank)}>Cancel</button>}</div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data.packages.map((p) => (
          <div key={p.id} className={card}>
            <div className="flex items-start justify-between"><div><b>{p.name}</b> {!p.isActive && <span className="text-xs text-muted-foreground">(closed)</span>}<div className="text-xs text-muted-foreground">{p.destination} · {p.durationDays} days · departs {fmtDate(p.departureDate)}</div></div><b>{money(p.pricePerPerson, p.currency)}</b></div>
            <div className="mt-2 text-xs">{p.seats ? `${p.booked}/${p.seats} seats booked` : `${p.booked} booked`}</div>
            {p.seats > 0 && <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.min(100, (p.booked / p.seats) * 100)}%` }} /></div>}
            <button className={`${btn2} mt-3`} onClick={() => setF({ id: p.id, name: p.name, destination: p.destination, durationDays: p.durationDays, pricePerPerson: String(p.pricePerPerson), departureDate: dateInput(p.departureDate), seats: p.seats, depositPercent: p.depositPercent, inclusions: p.inclusions ?? "", isActive: p.isActive })}>Edit</button>
          </div>
        ))}
        {!data.packages.length && <Empty text="No packages yet. Create a group tour or pilgrimage with seats and a fixed price." />}
      </div>
    </section>
  );
}

function Visas({ slug, data, pending, run, money }: { slug: string; data: Data; pending: boolean; run: Run; money: (n: unknown, c?: string) => string }) {
  const [f, setF] = useState({ clientId: "", country: "", visaType: "TOURIST", fee: "", appointmentAt: "" });
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-bold">New visa case</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <select className={inp} value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Client…</option>{data.clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}</select>
          <input className={inp} placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
          <select className={inp} value={f.visaType} onChange={(e) => setF({ ...f, visaType: e.target.value })}>{VISA_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
          <input type="number" min={0} className={inp} placeholder="Service fee" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} />
          <input type="date" className={inp} value={f.appointmentAt} onChange={(e) => setF({ ...f, appointmentAt: e.target.value })} title="Appointment" />
        </div>
        <button className={btn} disabled={pending} onClick={() => run(() => A.createTravelVisaCase(slug, { ...f, fee: f.fee === "" ? undefined : Number(f.fee) }), "Visa case opened", () => setF({ clientId: "", country: "", visaType: "TOURIST", fee: "", appointmentAt: "" }))}>Open case</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.visas.map((v) => (
          <div key={v.id} className={card}>
            <div className="flex items-start justify-between gap-2"><div><b>{v.clientName}</b> → {v.country}<div className="text-xs text-muted-foreground">{v.visaType} · fee {money(v.fee)} · appt {fmtDate(v.appointmentAt)}</div></div>
              <select className={`${inp} max-w-[11rem]`} value={v.status} disabled={pending} onChange={(e) => run(() => A.updateTravelVisaCase(slug, v.id, { status: e.target.value }), "Status updated")}>{VISA_STATUSES.map((s) => <option key={s} value={s}>{VISA_STATUS_LABEL[s]}</option>)}</select></div>
            <div className="mt-2 space-y-1">{v.checklist.map((c, i) => <label key={i} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.done} disabled={pending} onChange={() => run(() => A.updateTravelVisaCase(slug, v.id, { toggleChecklistIndex: i }))} /><span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span></label>)}</div>
            <div className="mt-2 text-xs text-muted-foreground">{v.checklist.filter((c) => c.done).length}/{v.checklist.length} documents ready</div>
          </div>
        ))}
        {!data.visas.length && <Empty text="No visa cases yet." />}
      </div>
    </section>
  );
}

function Suppliers({ slug, data, pending, run }: { slug: string; data: Data; pending: boolean; run: Run }) {
  const blank = { id: "", name: "", kind: "AIRLINE", contactName: "", email: "", phone: "" };
  const [f, setF] = useState(blank);
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <h2 className="text-sm font-bold">{f.id ? "Edit supplier" : "Add supplier"}</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={inp} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{SUPPLIER_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input className={inp} placeholder="Contact person" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
          <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className={inp} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="flex gap-2"><button className={btn} disabled={pending} onClick={() => run(() => A.saveTravelSupplier(slug, { ...f, id: f.id || undefined }), "Supplier saved", () => setF(blank))}>Save supplier</button>{f.id && <button className={btn2} onClick={() => setF(blank)}>Cancel</button>}</div>
      </div>
      <div className="grid gap-2">
        {data.suppliers.map((s) => (
          <div key={s.id} className={`${card} flex items-center justify-between`}>
            <div><b>{s.name}</b> <span className="text-xs text-muted-foreground">{s.kind}</span><div className="text-xs text-muted-foreground">{[s.contactName, s.phone, s.email].filter(Boolean).join(" · ")}</div></div>
            <div className="flex gap-1"><button className={btn2} onClick={() => setF({ id: s.id, name: s.name, kind: s.kind, contactName: s.contactName ?? "", email: s.email ?? "", phone: s.phone ?? "" })}>Edit</button><button className={`${btn2} text-red-600`} disabled={pending} onClick={() => confirm("Archive this supplier?") && run(() => A.archiveTravelSupplier(slug, s.id), "Supplier archived")}>Archive</button></div>
          </div>
        ))}
        {!data.suppliers.length && <Empty text="No suppliers yet. Add airlines, hotels and tour operators you book through." />}
      </div>
    </section>
  );
}
