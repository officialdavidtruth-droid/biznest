"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft, BarChart3, CalendarDays, ChefHat, ShoppingBag, UtensilsCrossed, Users,
} from "lucide-react";
import { toast } from "sonner";
import { advanceKitchenOrderStatus } from "@/lib/actions/kitchen-ops";

function money(n: number) { return `₦${Number(n || 0).toLocaleString()}`; }
function time(v: string | Date) { return new Date(v).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
function label(v: string) { return v.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (m) => m.toUpperCase()); }
function badge(v: string) {
  if (["PAID", "COMPLETED", "DELIVERED", "CONFIRMED"].includes(v)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (["IN_PROGRESS", "PENDING"].includes(v)) return "bg-sky-500/10 text-sky-700 border-sky-500/20";
  if (["CANCELLED", "REFUNDED"].includes(v)) return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
}

type Tab = "pos" | "orders" | "tables" | "menu" | "customers" | "reports";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "pos", label: "POS", icon: ShoppingBag },
  { id: "orders", label: "Orders", icon: ChefHat },
  { id: "tables", label: "Tables & Reservations", icon: CalendarDays },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

export function KitchenOpsWorkspace({ slug, data }: { slug: string; data: any }) {
  const [tab, setTab] = useState<Tab>("orders");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (next: Tab) => { setTab(next); setMobileOpen(false); };

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-7">
        <button className="lg:hidden rounded-lg border p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><ChefHat className="h-4 w-4" /></button>
        <Link href={`/store/${slug}/admin/apps`} className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground lg:flex"><ArrowLeft className="h-4 w-4" /> Apps</Link>
        <div className="h-5 w-px bg-border hidden lg:block" />
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Kitchen Operations</p><p className="truncate text-sm font-bold">{data.storeName} · Service Workspace</p></div>
        <Link href={`/store/${slug}/admin/pos`} className="hidden rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground sm:inline-flex">Open POS</Link>
      </div>
    </header>
    <div className="flex">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 border-r bg-background pt-16 transition-transform lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:w-64 lg:translate-x-0 lg:self-start lg:pt-0`}>
        <nav className="h-full overflow-y-auto p-3">
          {tabs.map(({ id, label: text, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{text}</button>)}
          {data.role !== "STAFF" && <div className="mt-4 border-t pt-4 text-[10px] text-muted-foreground"><p className="px-3 font-semibold uppercase tracking-wider">Full workspace</p><Link href={`/store/${slug}/admin/fnb`} className="mt-2 flex items-center gap-2 px-3 py-2 hover:text-foreground"><ChefHat className="h-3.5 w-3.5" /> Open BizNest FnB</Link></div>}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-7">
        {tab === "pos" && <LinkPanel title="POS" description="Run walk-in and in-person sales through the existing hardened BizNest register." href={`/store/${slug}/admin/pos`} label="Open POS Register" icon={ShoppingBag} />}
        {tab === "orders" && <OrdersPanel slug={slug} orders={data.orders} />}
        {tab === "tables" && <TablesPanel reservations={data.reservations} />}
        {tab === "menu" && <MenuPanel products={data.products} />}
        {tab === "customers" && <CustomersPanel customers={data.customers} />}
        {tab === "reports" && <ReportsPanel metrics={data.metrics} />}
      </main>
    </div>
  </div>;
}

function OrdersPanel({ slug, orders }: { slug: string; orders: any[] }) {
  const [busy, start] = useTransition();
  const active = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status));
  const advance = (o: any) => {
    const next = o.status === "PAID" ? "IN_PROGRESS" : o.status === "IN_PROGRESS" ? "DELIVERED" : "COMPLETED";
    start(async () => { const r = await advanceKitchenOrderStatus(slug, o.id, next as any); if (!r.success) toast.error(r.error); else toast.success(`Order moved to ${label(next)}`); });
  };
  return <div className="space-y-5">
    <SectionTitle title="Live Orders" description="Today's orders — the same records used by POS and online checkout." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {active.map((o) => <div key={o.id} className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">#{o.id.slice(-6).toUpperCase()}</p><p className="mt-1 text-[10px] text-muted-foreground">{o.channel} · {time(o.createdAt)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${badge(o.status)}`}>{label(o.status)}</span></div>
        <div className="mt-4 space-y-2">{o.items.map((i: any, idx: number) => <div key={idx} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"><span>{i.quantity} × {i.variant?.product?.name ? `${i.variant.product.name} — ${i.variant.label}` : i.product?.name || "Menu item"}</span></div>)}</div>
        <button disabled={busy} onClick={() => advance(o)} className="mt-4 w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{o.status === "PAID" ? "Start preparing" : o.status === "IN_PROGRESS" ? "Mark ready" : "Complete order"}</button>
      </div>)}
      {active.length === 0 && <Empty text="No active orders right now." />}
    </div>
  </div>;
}

function TablesPanel({ reservations }: { reservations: any[] }) {
  return <div className="space-y-5">
    <SectionTitle title="Tables & Reservations" description="Today's reservations, from the same booking records as the rest of BizNest." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {reservations.map((r) => <div key={r.id} className="rounded-2xl border p-4">
        <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold">{r.guestName || "Guest"}</p><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${badge(r.status)}`}>{label(r.status)}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{time(r.scheduledAt)}{r.partySize ? ` · Party of ${r.partySize}` : ""}</p>
      </div>)}
      {reservations.length === 0 && <Empty text="No reservations booked for today." />}
    </div>
  </div>;
}

function MenuPanel({ products }: { products: any[] }) {
  return <div className="space-y-5">
    <SectionTitle title="Menu" description="Read-only view of what's currently sellable. Menu, pricing and catalog changes are made by owners or managers." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {products.slice(0, 60).map((p) => <div key={p.id} className="rounded-2xl border p-4">
        <p className="text-sm font-bold">{p.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{money(p.price)} · {p.inventory ? `${p.inventory.quantity} in stock` : "No stock tracking"}</p>
      </div>)}
      {products.length === 0 && <Empty text="No menu items published yet." />}
    </div>
  </div>;
}

function CustomersPanel({ customers }: { customers: any[] }) {
  return <div className="space-y-5">
    <SectionTitle title="Customers" description="Guest and buyer information connected to order history." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {customers.map((c) => <div key={c.id} className="rounded-2xl border p-4"><p className="text-sm font-bold">{c.name}</p><p className="mt-1 text-xs text-muted-foreground">{c.phone || c.email || "No contact"}</p></div>)}
      {customers.length === 0 && <Empty text="No customer profiles yet." />}
    </div>
  </div>;
}

function ReportsPanel({ metrics: m }: { metrics: any }) {
  return <div className="space-y-5">
    <SectionTitle title="Today's Reports" description="A quick read on today's service so far." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Today's sales" value={money(m.revenue)} />
      <Metric label="Orders today" value={m.ordersToday} />
      <Metric label="Active orders" value={m.activeOrders} />
      <Metric label="Reservations today" value={m.reservationsToday} />
    </div>
  </div>;
}

function LinkPanel({ title, description, href, label: actionLabel, icon: Icon }: any) {
  return <div className="mx-auto flex min-h-[55vh] max-w-3xl items-center"><section className="w-full rounded-3xl border bg-background p-7 text-center shadow-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-7 w-7" /></span><h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground">{actionLabel}</Link></section></div>;
}
function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>;
}
function Metric({ label: text, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border bg-background p-4 shadow-sm"><span className="text-[11px] font-medium text-muted-foreground">{text}</span><p className="mt-2 text-xl font-bold tracking-tight">{value}</p></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="col-span-full py-10 text-center text-xs text-muted-foreground">{text}</div>;
}
