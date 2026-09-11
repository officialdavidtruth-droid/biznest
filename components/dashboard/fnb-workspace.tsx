"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CalendarDays, ChefHat,
  ClipboardCheck, Clock3, DollarSign, LayoutDashboard, PackageCheck,
  RefreshCw, Search, Settings2, Trash2, UtensilsCrossed, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { saveFnbRecipe, recordFnbWaste, setFnbRotationMode, updateFnbKitchenOrderStatus } from "@/lib/actions/fnb";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import type { FnbRotationMode } from "@/lib/fnb-settings";

function money(n: number) { return `₦${Number(n || 0).toLocaleString()}`; }
function date(v: string | Date) { return new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short" }); }
function time(v: string | Date) { return new Date(v).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
function label(v: string) { return v.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (m) => m.toUpperCase()); }
function badge(v: string) {
  if (["PAID", "COMPLETED", "DELIVERED", "AVAILABLE", "IN_STOCK", "RECEIVED"].includes(v)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (["IN_PROGRESS", "CONFIRMED", "SENT", "PARTIALLY_RECEIVED"].includes(v)) return "bg-sky-500/10 text-sky-700 border-sky-500/20";
  if (["CANCELLED", "REFUNDED", "OUT_OF_STOCK"].includes(v)) return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
}

type Tab = "dashboard" | "kitchen" | "recipes" | "wastage" | "reports" | "settings";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "kitchen", label: "Kitchen Display", icon: ChefHat },
  { id: "recipes", label: "Recipes & Food Cost", icon: ClipboardCheck },
  { id: "wastage", label: "Wastage Control", icon: Trash2 },
  { id: "reports", label: "F&B Intelligence", icon: BarChart3 },
  { id: "settings", label: "FnB Settings", icon: Settings2 },
];

export function FnbWorkspace({ slug, data }: { slug: string; data: any }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const m = data.metrics;
  const navigate = (next: Tab) => { setTab(next); setMobileOpen(false); };

  return <div className="bn-fnb-workspace min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 shadow-[0_1px_10px_rgba(111,78,55,0.06)] backdrop-blur">
      <div className="flex min-h-[72px] items-center gap-3 px-4 py-3 lg:px-7">
        <Link href={`/store/${slug}/admin/apps`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-foreground transition hover:bg-muted" aria-label="Back to apps">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open FnB menu">
          <LayoutDashboard className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#6F4E37]/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#6F4E37]">BizNest FnB</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Specialized operations</span>
          </div>
          <p className="mt-1 truncate text-sm font-bold">{data.storeName}</p>
        </div>
        <Link href={`/${slug}/admin`} className="hidden rounded-xl border border-[#6F4E37]/20 bg-[#6F4E37]/5 px-3 py-2 text-xs font-bold text-[#6F4E37] sm:inline-flex">Back to Dashboard</Link>
      </div>
    </header>
    <div className="flex">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-white pt-20 transition-transform lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:w-64 lg:translate-x-0 lg:self-start lg:pt-0`}>
        <nav className="h-full overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6F4E37]">F&B Operations</p>
          {tabs.map(({ id, label: text, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${tab === id ? "bg-[#6F4E37]/10 text-[#6F4E37]" : "text-muted-foreground hover:bg-[#6F4E37]/5 hover:text-foreground"}`}><Icon className="h-4 w-4" />{text}</button>)}
          <div className="mt-5 rounded-xl border border-[#6F4E37]/15 bg-[#6F4E37]/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#6F4E37]">Core BizNest stays in Dashboard</p>
            <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">POS, orders, inventory, suppliers, purchasing, customers, payments and bookings remain in their existing core modules. FnB adds only restaurant-specific capabilities.</p>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-7">
        {tab === "dashboard" && <Dashboard slug={slug} data={data} navigate={navigate} />}
        {tab === "kitchen" && <Kitchen slug={slug} orders={data.orders} />}
        {tab === "recipes" && <Recipes slug={slug} products={data.products} inventory={data.inventory} />}
        {tab === "wastage" && <WastagePanel slug={slug} data={data} />}
        {tab === "reports" && <Reports data={data} />}
        {tab === "settings" && <SettingsPanel slug={slug} mode={data.mode} />}
      </main>
    </div>
  </div>;
}

function Dashboard({ slug, data, navigate }: { slug: string; data: any; navigate: (t: Tab) => void }) {
  const m = data.metrics;
  const alerts = m.outOfStock + m.lowStock + m.expired + m.expiringSoon;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-[#6F4E37]">Food & Beverage Intelligence</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{data.storeName} operations</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">A specialist layer for kitchen execution, recipe costing, food waste, stock rotation and restaurant-specific operational intelligence.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={ChefHat} label="Active kitchen" value={m.activeOrders} sub="Orders requiring kitchen action" />
      <Metric icon={ClipboardCheck} label="Recipe coverage" value={m.recipeCount} sub="Menu items with recipes" />
      <Metric icon={Trash2} label="Waste units" value={m.wasteUnits} sub="Recently recorded" />
      <Metric icon={PackageCheck} label="Rotation" value={data.mode} sub="Current stock policy" />
    </div>
    {alerts > 0 && <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center"><AlertTriangle className="h-5 w-5" /><div className="flex-1"><p className="text-sm font-bold">Core inventory needs attention</p><p className="mt-1 text-xs">There are {m.lowStock} low-stock, {m.outOfStock} out-of-stock, {m.expiringSoon} expiring and {m.expired} expired batch records in the core inventory.</p></div><Link href={`/store/${slug}/admin/inventory`} className="text-xs font-bold underline">Review in Inventory</Link></div>}
    <div className="grid gap-4 xl:grid-cols-3">
      <QuickCard title="Service execution" icon={ChefHat} items={["Kitchen Display", "Recipes & Food Cost"]} onClick={(i) => navigate(i === 0 ? "kitchen" : "recipes")} />
      <QuickCard title="Loss control" icon={Trash2} items={["Wastage Control", "FIFO / FEFO Settings"]} onClick={(i) => navigate(i === 0 ? "wastage" : "settings")} />
      <QuickCard title="Restaurant intelligence" icon={BarChart3} items={["F&B Intelligence", "Recipe Coverage"]} onClick={(i) => navigate("reports")} />
    </div>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-[#6F4E37]" /><h2 className="text-sm font-bold">What this plugin adds</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Specialty title="Kitchen Display" text="Turn existing orders into a live kitchen queue." /><Specialty title="Recipe Costing" text="Map menu items to ingredients and calculate recipe cost." /><Specialty title="Wastage Control" text="Record food loss with an auditable stock movement." /><Specialty title="FIFO / FEFO" text="Choose how food stock is allocated from batches." /></div></section>
  </div>;
}
function Specialty({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-[#6F4E37]/10 bg-[#6F4E37]/[0.025] p-4"><p className="text-xs font-bold text-[#6F4E37]">{title}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text}</p></div>; }

function Kitchen({ slug, orders }: { slug: string; orders: any[] }) {
  const [busy, start] = useTransition();
  const kitchenOrders = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status));
  const advance = (o: any) => {
    const next = o.status === "PAID" ? "IN_PROGRESS" : o.status === "IN_PROGRESS" ? "DELIVERED" : "COMPLETED";
    start(async () => { const r = await updateFnbKitchenOrderStatus(slug, o.id, next as any); if (!r.success) toast.error(r.error); else toast.success(`Order moved to ${label(next)}`); });
  };
  return <div className="space-y-5"><SectionTitle title="Kitchen Display" description="A live kitchen queue using the same order records as POS and online checkout." action={<Link href={`/store/${slug}/admin/orders`} className="rounded-xl border px-3 py-2 text-xs font-bold">All orders</Link>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{kitchenOrders.map((o: any) => <div key={o.id} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">#{o.id.slice(-6).toUpperCase()}</p><p className="mt-1 text-[10px] text-muted-foreground">{o.channel} · {time(o.createdAt)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${badge(o.status)}`}>{label(o.status)}</span></div><div className="mt-4 space-y-2">{o.items.map((i: any, idx: number) => <div key={idx} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"><span>{i.quantity} × {i.variant?.product?.name ? `${i.variant.product.name} — ${i.variant.label}` : i.product?.name || "Menu item"}</span></div>)}</div><button disabled={busy} onClick={() => advance(o)} className="mt-4 w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{o.status === "PAID" ? "Start preparing" : o.status === "IN_PROGRESS" ? "Mark ready" : "Complete order"}</button></div>)}{kitchenOrders.length === 0 && <Empty text="No active kitchen tickets right now." />}</div></div>;
}

function WastagePanel({ slug, data }: { slug: string; data: any }) { const [item, setItem] = useState(data.inventory[0]?.id || ""); const [qty, setQty] = useState(1); const [reason, setReason] = useState(""); const [busy, start] = useTransition(); const submit = () => start(async () => { const r = await recordFnbWaste(slug, item, Number(qty), reason); if (!r.success) toast.error(r.error); else { toast.success("Waste recorded and stock reconciled"); setReason(""); setQty(1); } }); return <div className="space-y-5"><SectionTitle title="Wastage Control" description="Record spoilage, expired stock, damaged food and overproduction with an auditable stock movement." /><div className="grid gap-5 xl:grid-cols-[420px_1fr]"><div className="rounded-2xl border p-5"><label className="text-xs font-bold">Stock item</label><select value={item} onChange={(e) => setItem(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 text-sm">{data.inventory.map((i: any) => <option key={i.id} value={i.id}>{i.product.name} · {i.quantity} available</option>)}</select><label className="mt-4 block text-xs font-bold">Quantity wasted</label><input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 text-sm" /><label className="mt-4 block text-xs font-bold">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expired, spoiled, burnt, damaged, overproduction..." className="mt-2 min-h-24 w-full rounded-xl border bg-background px-3 py-2.5 text-sm" /><button disabled={busy} onClick={submit} className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Record waste</button></div><div className="rounded-2xl border p-5"><h2 className="text-sm font-bold">Recent waste</h2><div className="mt-4 divide-y">{data.wasteMovements.map((w: any) => <div key={w.id} className="flex items-center gap-3 py-3"><Trash2 className="h-4 w-4 text-rose-600" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{w.inventoryItem?.product?.name || "Stock item"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{String(w.note || "").replace("FNB WASTE: ", "")} · {date(w.createdAt)}</p></div><span className="text-xs font-bold">{Math.abs(w.quantityChange)}</span></div>)}{data.wasteMovements.length === 0 && <Empty text="No waste records yet." />}</div></div></div></div>; }

function Reports({ data }: { data: any }) { const m = data.metrics; const recipeCost = data.products.reduce((sum: number, p: any) => { const r = extractFnbRecipe(p.attributes); if (!r) return sum; return sum + r.ingredients.reduce((s: number, i: any) => { const stock = data.inventory.find((x: any) => x.id === i.inventoryItemId); return s + (stock?.costPrice || 0) * i.quantity; }, 0); }, 0); const coverage = data.products.length ? Math.round((m.recipeCount / data.products.length) * 100) : 0; return <div className="space-y-5"><SectionTitle title="F&B Intelligence" description="Restaurant-specific intelligence built on top of the core BizNest records. Core sales, inventory and customer reports remain in the main dashboard." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ClipboardCheck} label="Recipe coverage" value={`${coverage}%`} sub={`${m.recipeCount} configured recipes`} /><Metric icon={Zap} label="Configured recipe cost" value={money(recipeCost)} sub="Current ingredient cost basis" /><Metric icon={Trash2} label="Waste units" value={m.wasteUnits} sub="Recorded F&B waste" /><Metric icon={Clock3} label="Active kitchen" value={m.activeOrders} sub="Orders in service flow" /></div><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border bg-white p-5"><h2 className="text-sm font-bold">Food control risks</h2><div className="mt-4 space-y-3"><ReportRow label="Recipes missing" value={Math.max(0, data.products.length - m.recipeCount)} /><ReportRow label="Waste units" value={m.wasteUnits} /><ReportRow label="Expiring within 7 days" value={m.expiringSoon} /><ReportRow label="Expired batches" value={m.expired} /></div></section><section className="rounded-2xl border bg-white p-5"><h2 className="text-sm font-bold">Specialized operations</h2><div className="mt-4 space-y-3"><ReportRow label="Kitchen tickets active" value={m.activeOrders} /><ReportRow label="Recipe coverage %" value={coverage} /><ReportRow label="Current rotation policy" value={data.mode === "FIFO" ? 1 : 2} /><ReportRow label="Waste records" value={data.wasteMovements.length} /></div><p className="mt-3 text-[10px] text-muted-foreground">Rotation policy is shown as 1 = FIFO, 2 = FEFO. Detailed stock records remain in core Inventory.</p></section></div></div>; }

function SettingsPanel({ slug, mode }: { slug: string; mode: FnbRotationMode }) { const [value, setValue] = useState(mode); const [busy, start] = useTransition(); const save = () => start(async () => { const r = await setFnbRotationMode(slug, value); if (!r.success) toast.error(r.error); else toast.success(`Stock rotation set to ${value}`); }); return <div className="space-y-5"><SectionTitle title="FnB Settings" description="Configure how BizNest allocates stock from tracked batches." /><section className="max-w-3xl rounded-2xl border p-5"><div className="flex items-start gap-3"><PackageCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-bold">Stock rotation policy</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the policy used when stock is consumed. FIFO prioritizes the oldest received batch. FEFO prioritizes the nearest usable expiry. Every consumption remains linked to the stock movement ledger.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2"><button onClick={() => setValue("FIFO")} className={`rounded-xl border p-4 text-left ${value === "FIFO" ? "border-primary bg-primary/5" : ""}`}><p className="text-sm font-bold">FIFO — First In, First Out</p><p className="mt-1 text-xs text-muted-foreground">Oldest received stock is consumed first.</p></button><button onClick={() => setValue("FEFO")} className={`rounded-xl border p-4 text-left ${value === "FEFO" ? "border-primary bg-primary/5" : ""}`}><p className="text-sm font-bold">FEFO — First Expired, First Out</p><p className="mt-1 text-xs text-muted-foreground">Nearest usable expiry is consumed first.</p></button></div><button disabled={busy} onClick={save} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Save rotation policy</button></section><section className="max-w-3xl rounded-2xl border p-5"><h2 className="text-sm font-bold">Operational architecture</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">The FnB workspace is a dedicated vertical route, like BizNest PMS. The heavy operations UI is not nested inside the marketplace shell, reducing layout conflicts and making navigation safer.</p></section></div>; }

function SectionTitle({ title, description, action }: any) { return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>{action}</div>; }
function Metric({ icon: Icon, label: text, value, sub }: any) { return <div className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] font-medium text-muted-foreground">{text}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{sub}</p></div>; }
function QuickCard({ title, icon: Icon, items, onClick }: { title: string; icon: any; items: string[]; onClick: (i: number) => void }) { return <section className="rounded-2xl border p-5"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">{title}</h2></div><div className="mt-4 space-y-2">{items.map((x: string, i: number) => <button key={x} onClick={() => onClick(i)} className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-semibold hover:bg-muted"><span>{x}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></button>)}</div></section>; }
function ReportRow({ label: text, value }: { label: string; value: number }) { return <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-xs"><span className="text-muted-foreground">{text}</span><span className="font-bold">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full py-10 text-center text-xs text-muted-foreground">{text}</div>; }