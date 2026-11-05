"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRealEstateProperty, createRealEstateUnit } from "@/lib/actions/vertical-workspaces";
import {
  addRentCharge, assignTenant, createMaintenanceRequest, endTenancy, generateRentSchedule, recordRentPayment, regenerateRentPortalLink,
  updateMaintenanceRequest, updateRealEstateUnit, voidRentCharge,
} from "@/lib/actions/real-estate";
import { RENT_CYCLES, RENT_CYCLE_LABEL, RENT_PAYMENT_METHODS, chargeState, type RentCycle } from "@/lib/real-estate";
import type { RealEstateWorkspaceData } from "@/lib/real-estate-data";

type Unit = RealEstateWorkspaceData["properties"][number]["units"][number];
type Result = { success: boolean; error?: string };

const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) => {
    setError(""); setNote("");
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };
  return { pending, error, note, run };
}

function Msg({ error, note }: { error: string; note: string }) {
  if (error) return <p role="alert" className="text-xs text-red-600">{error}</p>;
  if (note) return <p role="status" className="text-xs text-emerald-700">{note}</p>;
  return null;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${tone === "bad" ? "text-red-600" : ""}`}>{value}</p></div>;
}

export function RealEstateWorkspace({ slug, data, portalBase, storeName }: { slug: string; data: RealEstateWorkspaceData; portalBase: string; storeName: string }) {
  const [tab, setTab] = useState<"rent" | "repairs">("rent");
  const openRepairs = data.maintenance.filter((m) => m.status === "OPEN" || m.status === "IN_PROGRESS").length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Outstanding" value={ngn(data.summary.outstanding)} />
        <Tile label="Overdue" value={ngn(data.summary.overdue)} tone={data.summary.overdue > 0 ? "bad" : undefined} />
        <Tile label="Collected" value={ngn(data.summary.paid)} />
        <Tile label="Open repairs" value={String(openRepairs)} />
      </div>
      <div className="flex gap-2" role="tablist">
        {(["rent", "repairs"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border"}`}>
            {t === "rent" ? "Properties and rent" : `Repairs${openRepairs ? ` (${openRepairs})` : ""}`}
          </button>
        ))}
      </div>
      {tab === "rent" ? <Properties slug={slug} data={data} portalBase={portalBase} storeName={storeName} /> : <Repairs slug={slug} data={data} />}
    </div>
  );
}

function Properties({ slug, data, portalBase, storeName }: { slug: string; data: RealEstateWorkspaceData; portalBase: string; storeName: string }) {
  const a = useAction();
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
        <input className={input} placeholder="Property name, e.g. Lekki Gardens Block A" value={name} onChange={(e) => setName(e.target.value)} aria-label="Property name" />
        <input className={input} placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Address" />
        <button className={btn} disabled={a.pending || !name.trim()} onClick={() => a.run(() => createRealEstateProperty(slug, { name, propertyType: "RESIDENTIAL", address }) as Promise<Result>, "Property added.", () => { setName(""); setAddress(""); })}>Add property</button>
        <div className="md:col-span-3"><Msg error={a.error} note={a.note} /></div>
      </div>
      {data.properties.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No properties yet. Add one above, then add its units.</div>}
      {data.properties.map((p) => <PropertyCard key={p.id} slug={slug} property={p} portalBase={portalBase} storeName={storeName} />)}
    </div>
  );
}

function PropertyCard({ slug, property, portalBase, storeName }: { slug: string; property: RealEstateWorkspaceData["properties"][number]; portalBase: string; storeName: string }) {
  const a = useAction();
  const [unitNo, setUnitNo] = useState(""); const [rent, setRent] = useState("");
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{property.name}</h2>
        <p className="text-xs text-muted-foreground">{property.address || "No address"} · {property.units.length} unit{property.units.length === 1 ? "" : "s"}</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input className={input} placeholder="Unit, e.g. Flat 3B" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} aria-label="Unit number" />
        <input className={input} inputMode="decimal" placeholder="Rent per period (₦)" value={rent} onChange={(e) => setRent(e.target.value)} aria-label="Rent amount" />
        <button className={btn} disabled={a.pending || !unitNo.trim()} onClick={() => a.run(() => createRealEstateUnit(slug, { propertyId: property.id, unitNo, rentAmount: rent ? Number(rent.replace(/,/g, "")) : undefined }) as Promise<Result>, "Unit added.", () => { setUnitNo(""); setRent(""); })}>Add unit</button>
      </div>
      <Msg error={a.error} note={a.note} />
      <div className="mt-4 space-y-3">
        {property.units.map((u) => <UnitRow key={u.id} slug={slug} unit={u} propertyName={property.name} portalBase={portalBase} storeName={storeName} />)}
      </div>
    </section>
  );
}

function UnitRow({ slug, unit, propertyName, portalBase, storeName }: { slug: string; unit: Unit; propertyName: string; portalBase: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const s = unit.summary;
  return (
    <div className="rounded-xl border">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div>
          <p className="font-semibold">{unit.unitNo} <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{unit.status === "OCCUPIED" ? unit.tenantName : "Vacant"}</span></p>
          <p className="text-xs text-muted-foreground">{unit.rentAmount ? `${ngn(unit.rentAmount)} ${RENT_CYCLE_LABEL[unit.rentCycle as RentCycle]?.toLowerCase() ?? ""}` : "No rent set"}</p>
        </div>
        <div className="text-right text-xs">
          {s.overdue > 0 ? <p className="font-semibold text-red-600">{ngn(s.overdue)} overdue</p> : s.outstanding > 0 ? <p>{ngn(s.outstanding)} due</p> : <p className="text-muted-foreground">Nothing due</p>}
        </div>
      </button>
      {open && <UnitDetail slug={slug} unit={unit} propertyName={propertyName} portalBase={portalBase} storeName={storeName} />}
    </div>
  );
}

function UnitDetail({ slug, unit, propertyName, portalBase, storeName }: { slug: string; unit: Unit; propertyName: string; portalBase: string; storeName: string }) {
  const a = useAction();
  const [t, setT] = useState({ name: unit.tenantName ?? "", email: unit.tenantEmail ?? "", phone: unit.tenantPhone ?? "" });
  const [rent, setRent] = useState(unit.rentAmount ? String(unit.rentAmount) : "");
  const [cycle, setCycle] = useState<string>(unit.rentCycle);
  const [leaseStart, setLeaseStart] = useState(unit.leaseStart?.slice(0, 10) ?? "");
  const [leaseEnd, setLeaseEnd] = useState(unit.leaseEnd?.slice(0, 10) ?? "");
  const [first, setFirst] = useState(""); const [periods, setPeriods] = useState("1");
  const [extra, setExtra] = useState({ label: "", amount: "", due: "" });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pay, setPay] = useState({ method: "TRANSFER", reference: "" });
  const [fix, setFix] = useState("");
  const link = unit.portalToken ? `${portalBase}${unit.portalToken}` : "";
  const wa = link && unit.tenantPhone ? `https://wa.me/${unit.tenantPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${unit.tenantName}, here is your rent account for ${propertyName} ${unit.unitNo} from ${storeName}: ${link}`)}` : "";
  const num = (v: string) => Number(v.replace(/,/g, ""));

  return (
    <div className="space-y-5 border-t p-3 text-sm">
      <Msg error={a.error} note={a.note} />

      <div className="grid gap-2 md:grid-cols-3">
        <input className={input} placeholder="Tenant name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} aria-label="Tenant name" />
        <input className={input} placeholder="Email (for receipts)" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} aria-label="Tenant email" />
        <input className={input} placeholder="Phone / WhatsApp" value={t.phone} onChange={(e) => setT({ ...t, phone: e.target.value })} aria-label="Tenant phone" />
        <input className={input} inputMode="decimal" placeholder="Rent per period (₦)" value={rent} onChange={(e) => setRent(e.target.value)} aria-label="Rent per period" />
        <select className={input} value={cycle} onChange={(e) => setCycle(e.target.value)} aria-label="Rent cycle">{RENT_CYCLES.map((c) => <option key={c} value={c}>{RENT_CYCLE_LABEL[c]}</option>)}</select>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={input} value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} aria-label="Lease start" />
          <input type="date" className={input} value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} aria-label="Lease end" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={a.pending || !t.name.trim()} onClick={() => a.run(() => assignTenant(slug, unit.id, { ...t, leaseStart: leaseStart || null, leaseEnd: leaseEnd || null, rentCycle: cycle, rentAmount: rent ? num(rent) : undefined }), unit.tenantName ? "Tenant updated." : "Tenant added. Share their link below.")}>{unit.tenantName ? "Save tenant" : "Add tenant"}</button>
        {!unit.tenantName && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => updateRealEstateUnit(slug, unit.id, { rentAmount: rent ? num(rent) : null, rentCycle: cycle }), "Rent saved.")}>Save rent only</button>}
        {unit.tenantName && <button className={ghost} disabled={a.pending} onClick={() => { if (window.confirm("End this tenancy? The tenant's link will stop working. Unpaid charges stay on record.")) a.run(() => endTenancy(slug, unit.id), "Tenancy ended."); }}>End tenancy</button>}
      </div>

      {unit.tenantName && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-semibold">Tenant link</p>
          {link ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-background px-2 py-1 text-xs">{link}</code>
              <button className={ghost} onClick={() => { void navigator.clipboard?.writeText(link); }}>Copy</button>
              {wa && <a className={ghost} href={wa} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>}
              <button className={ghost} disabled={a.pending} onClick={() => { if (window.confirm("Replace the link? The old one stops working.")) a.run(() => regenerateRentPortalLink(slug, unit.id), "New link created."); }}>Replace link</button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Save the tenant to get their link.</p>}
        </div>
      )}

      {unit.tenantName && (
        <div className="space-y-3">
          <p className="text-xs font-semibold">Create rent charges</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs">First due<input type="date" className={input} value={first} onChange={(e) => setFirst(e.target.value)} /></label>
            <label className="grid gap-1 text-xs">Periods<input className={`${input} w-20`} inputMode="numeric" value={periods} onChange={(e) => setPeriods(e.target.value)} /></label>
            <button className={btn} disabled={a.pending || !first} onClick={() => a.run(() => generateRentSchedule(slug, unit.id, { startDate: first, periods: Number(periods) || 1 }), "Charges created.")}>Create</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input className={`${input} w-44`} placeholder="Other charge, e.g. Service charge" value={extra.label} onChange={(e) => setExtra({ ...extra, label: e.target.value })} aria-label="Charge name" />
            <input className={`${input} w-28`} inputMode="decimal" placeholder="Amount" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} aria-label="Charge amount" />
            <input type="date" className={`${input} w-40`} value={extra.due} onChange={(e) => setExtra({ ...extra, due: e.target.value })} aria-label="Charge due date" />
            <button className={ghost} disabled={a.pending || !extra.label.trim() || !extra.amount || !extra.due} onClick={() => a.run(() => addRentCharge(slug, unit.id, { label: extra.label, amount: num(extra.amount), dueDate: extra.due }), "Charge added.", () => setExtra({ label: "", amount: "", due: "" }))}>Add charge</button>
          </div>
        </div>
      )}

      {unit.charges.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {unit.charges.map((c) => {
            const st = chargeState({ status: c.status, dueDate: c.dueDate, amount: c.amount });
            return (
              <li key={c.id} className="p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{st === "PAID" ? `Paid ${day(c.paidAt)}${c.receiptNo ? ` · ${c.receiptNo}` : ""}${c.method ? ` · ${c.method.toLowerCase()}` : ""}` : `Due ${day(c.dueDate)}${st === "OVERDUE" ? " · overdue" : ""}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <b>{ngn(c.amount)}</b>
                    {c.status === "DUE" && <>
                      <button className={ghost} onClick={() => setPayingId(payingId === c.id ? null : c.id)}>Mark paid</button>
                      <button className={ghost} disabled={a.pending} onClick={() => { if (window.confirm("Cancel this charge?")) a.run(() => voidRentCharge(slug, c.id), "Charge cancelled."); }}>Cancel</button>
                    </>}
                  </div>
                </div>
                {payingId === c.id && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <select className={`${input} w-32`} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} aria-label="Payment method">{RENT_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</option>)}</select>
                    <input className={`${input} w-48`} placeholder="Reference (optional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} aria-label="Payment reference" />
                    <button className={btn} disabled={a.pending} onClick={() => a.run(() => recordRentPayment(slug, c.id, pay), "Payment recorded and receipt issued.", () => setPayingId(null))}>Record payment</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <input className={`${input} max-w-xs`} placeholder="Log a repair for this unit" value={fix} onChange={(e) => setFix(e.target.value)} aria-label="Repair description" />
        <button className={ghost} disabled={a.pending || !fix.trim()} onClick={() => a.run(() => createMaintenanceRequest(slug, unit.id, { title: fix }), "Repair logged.", () => setFix(""))}>Log repair</button>
      </div>
    </div>
  );
}

function Repairs({ slug, data }: { slug: string; data: RealEstateWorkspaceData }) {
  const a = useAction();
  const [vendors, setVendors] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  if (!data.maintenance.length) return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No repair requests yet. Tenants can report faults from their link.</div>;
  return (
    <div className="space-y-3">
      <Msg error={a.error} note={a.note} />
      {data.maintenance.map((m) => (
        <div key={m.id} className="rounded-xl border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{m.title}{m.priority === "URGENT" && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Urgent</span>}</p>
              <p className="text-xs text-muted-foreground">{m.propertyName}, {m.unitNo} · {m.reportedBy === "TENANT" ? "Reported by tenant" : "Logged by staff"} · {day(m.createdAt)}</p>
              {m.detail && <p className="mt-1 text-xs">{m.detail}</p>}
            </div>
            <select className="rounded-lg border bg-background px-2 py-1 text-xs" value={m.status} disabled={a.pending} aria-label="Status" onChange={(e) => a.run(() => updateMaintenanceRequest(slug, m.id, { status: e.target.value }))}>
              <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Fixed</option><option value="CANCELLED">Closed</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input className={`${input} w-44`} placeholder="Contractor" value={vendors[m.id] ?? m.vendor ?? ""} onChange={(e) => setVendors({ ...vendors, [m.id]: e.target.value })} aria-label="Contractor" />
            <input className={`${input} w-28`} inputMode="decimal" placeholder="Cost (₦)" value={costs[m.id] ?? (m.cost != null ? String(m.cost) : "")} onChange={(e) => setCosts({ ...costs, [m.id]: e.target.value })} aria-label="Cost" />
            <button className={ghost} disabled={a.pending} onClick={() => a.run(() => updateMaintenanceRequest(slug, m.id, { vendor: vendors[m.id] ?? m.vendor ?? null, cost: (costs[m.id] ?? (m.cost != null ? String(m.cost) : "")) === "" ? null : Number((costs[m.id] ?? String(m.cost)).replace(/,/g, "")) }), "Saved.")}>Save</button>
          </div>
        </div>
      ))}
    </div>
  );
}
