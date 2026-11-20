"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BarChart3, Boxes, ChefHat, Clock3, DollarSign, FileSignature, PackageCheck, Search, Trash2, Truck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { recordFnbWaste, setFnbRotationMode } from "@/lib/actions/fnb";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import { formatNumber } from "@/lib/i18n/locale";
import { Avatar, Chip, Empty, Field, Meter, Page, Section, Segmented, Stat, btnGhost, btnPrimary, card, date, input, label, money, statusTone, toneStyle, type Tone } from "./ui";

const stockState = (i: any): { key: "out" | "low" | "ok"; tone: Tone; text: string } => i.quantity === 0 ? { key: "out", tone: "bad", text: "Out of stock" } : i.quantity <= i.lowStockThreshold ? { key: "low", tone: "warn", text: "Running low" } : { key: "ok", tone: "ok", text: "In stock" };

/* ───────────── Inventory ───────────── */
export function InventoryPanel({ slug, data }: { slug: string; data: any }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "low" | "out">("all");
  const items = data.inventory.filter((i: any) => !i.isDish);
  const rows = items.filter((i: any) => i.product.name.toLowerCase().includes(q.toLowerCase()) && (f === "all" || stockState(i).key === (f === "low" ? "low" : "out")));
  const nLow = items.filter((i: any) => stockState(i).key === "low").length; const nOut = items.filter((i: any) => stockState(i).key === "out").length;
  const canManage = data.role !== "STAFF";
  return <Page title="Stock" sub="What's on the shelf, what it cost and what's running out." action={<Link href={`/store/${slug}/admin/inventory`} className={btnGhost}>Manage stock</Link>}>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={Boxes} label="Items tracked" value={items.length} sub="Ingredients & goods" />
      <Stat icon={Clock3} label="Running low" value={data.metrics.lowStock} sub="At or below alert level" tone="warn" />
      <Stat icon={XCircle} label="Out of stock" value={data.metrics.outOfStock} sub="Needs restocking" tone="bad" />
      <Stat icon={DollarSign} label="Stock value" value={money(data.metrics.stockValue)} sub="At cost" tone="info" />
    </div>
    <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[var(--bn-admin-muted)]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" className={`${input} pl-10`} /></div>
    <Segmented value={f} onChange={setF} options={[{ id: "all", label: "All", count: items.length }, { id: "low", label: "Low", count: nLow }, { id: "out", label: "Out", count: nOut }]} />
    <div className="grid gap-2.5 md:grid-cols-2">{rows.map((i: any) => { const s = stockState(i); const lots = data.batches.filter((b: any) => b.inventoryItem?.id === i.id); const max = Math.max(i.quantity, i.lowStockThreshold * 3, 1);
      return <div key={i.id} className={`${card} p-3.5`}>
        <div className="flex items-center gap-3"><Avatar name={i.product.name} tone={s.tone} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{i.product.name}</p><p className="text-[11px] text-[var(--bn-admin-muted)]">{i.costPrice == null ? "No cost set" : `${money(i.costPrice)} each`}{lots.length ? ` · ${lots.length} batch${lots.length > 1 ? "es" : ""}` : ""}</p></div><div className="text-right"><p className="text-lg font-extrabold leading-none text-[var(--bn-admin-text-strong)]">{formatNumber(i.quantity)}</p><div className="mt-1"><Chip tone={s.tone}>{s.text}</Chip></div></div></div>
        <div className="mt-3"><Meter value={i.quantity} max={max} tone={s.tone} /></div>
      </div>; })}
    {rows.length === 0 && <Empty icon={Boxes} title={items.length ? "Nothing matches" : "No stock yet"} text={items.length ? "Try another search or filter." : "Ingredients you create in a recipe show up here."} />}</div>
    <p className="text-[11px] text-[var(--bn-admin-muted)]">{canManage ? "Use Manage stock for counts, adjustments and batches." : "Stock editing is limited to owners and managers."}</p>
  </Page>;
}

/* ───────────── Procurement ───────────── */
export function ProcurementPanel({ slug, purchaseOrders }: { slug: string; purchaseOrders: any[] }) {
  const open = purchaseOrders.filter((p) => ["SENT", "PARTIALLY_RECEIVED"].includes(p.status));
  return <Page title="Purchasing" sub="Orders to suppliers and what's still on the way." action={<Link href={`/store/${slug}/admin/purchase-orders`} className={btnPrimary}>New order</Link>}>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={FileSignature} label="Recent orders" value={purchaseOrders.length} sub="Latest 30" tone="info" />
      <Stat icon={Clock3} label="On the way" value={open.length} sub="Awaiting delivery" tone="warn" />
      <Stat icon={Truck} label="Suppliers used" value={new Set(purchaseOrders.map((p) => p.supplier.name)).size} sub="Recent orders" />
      <Stat icon={DollarSign} label="Order value" value={money(purchaseOrders.reduce((s, p) => s + Number(p.subtotal), 0))} sub="Recent total" tone="info" />
    </div>
    <div className="space-y-2.5">{purchaseOrders.map((p) => { const ordered = p.items?.reduce((s: number, i: any) => s + i.quantityOrdered, 0) || 0; const got = p.items?.reduce((s: number, i: any) => s + i.quantityReceived, 0) || 0;
      return <div key={p.id} className={`${card} p-3.5`}><div className="flex items-center gap-3"><Avatar name={p.supplier.name} tone={statusTone(p.status)} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{p.poNumber}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{p.supplier.name}</p></div><div className="text-right"><p className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{p.currency} {formatNumber(Number(p.subtotal))}</p><Chip tone={statusTone(p.status)}>{label(p.status)}</Chip></div></div>{ordered > 0 && <div className="mt-3"><Meter value={got} max={ordered} /><p className="mt-1 text-[11px] text-[var(--bn-admin-muted)]">{got} of {ordered} received</p></div>}</div>; })}
    {purchaseOrders.length === 0 && <Empty icon={FileSignature} title="No purchase orders yet" text="Raise an order when stock runs low." />}</div>
  </Page>;
}

/* ───────────── Suppliers ───────────── */
export function SupplierPanel({ slug, suppliers }: { slug: string; suppliers: any[] }) {
  return <Page title="Suppliers" sub="Who you buy from." action={<Link href={`/store/${slug}/admin/suppliers`} className={btnGhost}>Manage</Link>}>
    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">{suppliers.map((s) => <div key={s.id} className={`${card} flex items-center gap-3 p-3.5`}><Avatar name={s.name} tone="info" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{s.name}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{s.contactName || "No contact name"}</p></div>{(s.phone || s.email) && (s.phone ? <a href={`tel:${s.phone}`} className={`${btnGhost} !min-h-9 !px-3 text-xs`}>Call</a> : <a href={`mailto:${s.email}`} className={`${btnGhost} !min-h-9 !px-3 text-xs`}>Email</a>)}</div>)}
    {suppliers.length === 0 && <Empty icon={Truck} title="No suppliers yet" text="Add the people you buy ingredients from." />}</div>
  </Page>;
}

/* ───────────── Customers ───────────── */
export function CustomerPanel({ customers }: { customers: any[] }) {
  return <Page title="Customers" sub="People who have ordered from you.">
    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">{customers.map((c) => <div key={c.id} className={`${card} flex items-center gap-3 p-3.5`}><Avatar name={c.name || "?"} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{c.name}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{c.phone || c.email || "No contact"}</p></div>{c.phone && <a href={`tel:${c.phone}`} className={`${btnGhost} !min-h-9 !px-3 text-xs`}>Call</a>}</div>)}
    {customers.length === 0 && <Empty icon={Users} title="No customers yet" text="Customer profiles are created from orders." />}</div>
  </Page>;
}

/* ───────────── Wastage ───────────── */
export function WastagePanel({ slug, data }: { slug: string; data: any }) {
  const [item, setItem] = useState(data.inventory.find((i: any) => !i.isDish)?.id || "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const reasons = ["Expired", "Spoiled", "Burnt", "Dropped", "Overproduced"];
  const submit = () => start(async () => { const r = await recordFnbWaste(slug, item, Number(qty), reason); if (!r.success) toast.error(r.error); else { toast.success("Waste recorded and stock updated"); setReason(""); setQty("1"); } });
  return <Page title="Waste" sub="Log spoiled, expired or dropped stock so your numbers stay honest.">
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <Section title="Record waste"><div className="space-y-4">
        <Field label="What was wasted"><select value={item} onChange={(e) => setItem(e.target.value)} className={input}>{data.inventory.filter((i: any) => !i.isDish).map((i: any) => <option key={i.id} value={i.id}>{i.product.name} · {i.quantity} left</option>)}</select></Field>
        <Field label="How much"><input type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={input} /></Field>
        <Field label="Why"><div className="mb-2 flex flex-wrap gap-1.5">{reasons.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${reason === r ? "border-transparent bg-[var(--bn-admin-active)] text-white" : "border-[var(--bn-admin-border)] text-[var(--bn-admin-muted)]"}`}>{r}</button>)}</div><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason" className={input} /></Field>
        <button disabled={busy || !item} onClick={submit} className={`${btnPrimary} w-full`}>{busy ? "Saving…" : "Record waste"}</button>
      </div></Section>
      <Section title="Recent waste"><div className="divide-y divide-[var(--bn-admin-border-soft)]">{data.wasteMovements.map((w: any) => <div key={w.id} className="flex items-center gap-3 py-3"><span style={toneStyle("warn")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"><Trash2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold text-[var(--bn-admin-text-strong)]">{w.inventoryItem?.product?.name || "Stock item"}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{String(w.note || "").replace("FNB WASTE: ", "") || "No reason"} · {date(w.createdAt)}</p></div><span className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">−{Math.abs(w.quantityChange)}</span></div>)}
      {data.wasteMovements.length === 0 && <Empty icon={Trash2} title="No waste logged" text="Nothing has been thrown away. Good." />}</div></Section>
    </div>
  </Page>;
}

/* ───────────── Reports ───────────── */
export function ReportsPanel({ data, kitchenInstalled = true }: { data: any; kitchenInstalled?: boolean }) {
  const m = data.metrics;
  const dishes = data.products.map((p: any) => { const r = extractFnbRecipe(p.attributes); if (!r || r.ingredients.length === 0) return null; const batch = r.ingredients.reduce((s: number, i: any) => { const st = data.inventory.find((x: any) => x.id === i.inventoryItemId); const c = st?.costPrice ?? (st?.product?.isPublished === false ? st.product.price : 0); return s + (c || 0) * i.quantity; }, 0); const cost = batch / (r.yieldQty > 0 ? r.yieldQty : 1); const price = Number(p.price) || 0; return { name: p.name, cost, price, pct: price > 0 ? Math.round(((price - cost) / price) * 100) : 0 }; }).filter(Boolean) as Array<{ name: string; cost: number; price: number; pct: number }>;
  const tc = dishes.reduce((s, d) => s + d.cost, 0); const tp = dishes.reduce((s, d) => s + d.price, 0);
  const foodCost = tp > 0 ? (tc / tp) * 100 : null;
  const ranked = [...dishes].sort((a, b) => b.pct - a.pct);
  const avg = m.ordersToday > 0 ? m.revenue / m.ordersToday : 0;
  if (!kitchenInstalled) {
    return <Page title="Reports" sub="How today's service is going.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Sales today" value={money(m.revenue)} sub={`${m.ordersToday} orders`} />
        <Stat icon={PackageCheck} label="Avg order" value={money(avg)} sub="Per paid order" tone="info" />
        <Stat icon={Users} label="Reservations" value={m.reservationsToday} sub="Today" tone="info" />
        <Stat icon={BarChart3} label="Orders" value={m.ordersToday} sub="Paid today" />
      </div>
      <Empty icon={ChefHat} title="Want food cost and stock reports?" text="Kitchen Management adds recipes, food cost, dish margins and stock reports." />
    </Page>;
  }
  return <Page title="Reports" sub="How the kitchen is doing, in numbers.">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={DollarSign} label="Sales today" value={money(m.revenue)} sub={`${m.ordersToday} orders`} />
      <Stat icon={PackageCheck} label="Avg food cost" value={foodCost == null ? "—" : `${foodCost.toFixed(0)}%`} sub={`${dishes.length} costed dishes`} tone={foodCost == null ? "mute" : foodCost <= 35 ? "ok" : foodCost <= 50 ? "warn" : "bad"} />
      <Stat icon={Boxes} label="Stock value" value={money(m.stockValue)} sub="At cost" tone="info" />
      <Stat icon={Trash2} label="Waste" value={m.wasteUnits} sub="Units logged" tone="warn" />
    </div>
    <Section title="Dish margins" hint="Best to worst, per portion.">
      {ranked.length === 0 ? <p className="text-sm text-[var(--bn-admin-muted)]">Add recipes to see which dishes earn the most.</p> : <div className="space-y-3">{ranked.map((d) => { const t: Tone = d.pct >= 65 ? "ok" : d.pct >= 50 ? "warn" : "bad"; return <div key={d.name}><div className="mb-1 flex items-center justify-between gap-3 text-[13px]"><span className="truncate font-semibold text-[var(--bn-admin-text)]">{d.name}</span><span className="shrink-0 font-extrabold text-[var(--bn-admin-text-strong)]">{d.pct}%</span></div><Meter value={d.pct} max={100} tone={t} /><p className="mt-1 text-[11px] text-[var(--bn-admin-muted)]">Costs {money(d.cost)} · sells {money(d.price)}</p></div>; })}</div>}
    </Section>
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Stock risks"><Rows rows={[["Out of stock", m.outOfStock, m.outOfStock ? "bad" : "mute"], ["Running low", m.lowStock, m.lowStock ? "warn" : "mute"], ["Expiring in 7 days", m.expiringSoon, m.expiringSoon ? "warn" : "mute"], ["Expired batches", m.expired, m.expired ? "bad" : "mute"]]} /></Section>
      <Section title="Service today"><Rows rows={[["Orders", m.ordersToday, "mute"], ["In the kitchen", m.activeOrders, "mute"], ["Reservations", m.reservationsToday, "mute"], ["Recipes set up", m.recipeCount, "mute"]]} /></Section>
    </div>
  </Page>;
}
function Rows({ rows }: { rows: Array<[string, number, Tone]> }) { return <div className="divide-y divide-[var(--bn-admin-border-soft)]">{rows.map(([t, v, tone]) => <div key={t} className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-[var(--bn-admin-muted)]">{t}</span><Chip tone={tone}>{v}</Chip></div>)}</div>; }

/* ───────────── Settings ───────────── */
export function SettingsPanel({ slug, role, mode }: { slug: string; role: string; mode: "FIFO" | "FEFO" }) {
  const canEdit = role !== "STAFF";
  const [busy, start] = useTransition();
  const [current, setCurrent] = useState(mode);
  const setMode = (next: "FIFO" | "FEFO") => start(async () => { const r = await setFnbRotationMode(slug, next); if (!r.success) toast.error(r.error); else { setCurrent(next); toast.success(`Stock rotation set to ${next}`); } });
  return <Page title="Settings" sub="How the kitchen uses your stock.">
    <Section title="Which stock gets used first?" hint="Applies to register sales and waste.">
      <div className="grid gap-3 sm:grid-cols-2">{(["FIFO", "FEFO"] as const).map((k) => <button key={k} disabled={!canEdit || busy} onClick={() => setMode(k)} className={`rounded-2xl border-2 p-4 text-left transition ${current === k ? "border-[var(--bn-admin-active)] bg-[var(--bn-admin-orange-soft)]" : "border-[var(--bn-admin-border)]"}`}><p className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{k === "FIFO" ? "Oldest first" : "Soonest to expire first"}</p><p className="mt-1 text-xs text-[var(--bn-admin-muted)]">{k === "FIFO" ? "Uses the batch you received earliest (FIFO)." : "Uses the batch with the nearest expiry date (FEFO)."}</p></button>)}</div>
      {!canEdit && <p className="mt-3 text-xs text-[var(--bn-admin-muted)]">Only owners and managers can change this.</p>}
    </Section>
    <Section title="What's switched on"><div className="divide-y divide-[var(--bn-admin-border-soft)]">{["Register", "Kitchen display", "Station routing", "Stock & purchasing"].map((t) => <div key={t} className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-[var(--bn-admin-muted)]">{t}</span><Chip tone="ok" dot>On</Chip></div>)}</div></Section>
  </Page>;
}
