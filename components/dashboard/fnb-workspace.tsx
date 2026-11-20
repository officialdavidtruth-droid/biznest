"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, BarChart3, Boxes, CalendarDays, ChefHat, ClipboardList, FileSignature, Home, LayoutGrid, Settings2,
  ShoppingBag, Trash2, Truck, Users, UtensilsCrossed, X, BookOpen,
} from "lucide-react";
import { getPosCatalog, getPosDailySummary } from "@/lib/actions/pos";
import { getOpenPosTabs } from "@/lib/actions/pos-tabs";
import { getInHouseReservations } from "@/lib/actions/folio";
import { setFnbCurrency, Chip } from "@/components/dashboard/fnb/ui";
import { KitchenPanel, OrdersPanel, OverviewPanel, PosPanel, TablesPanel } from "@/components/dashboard/fnb/service-panels";
import { MenuPanel, RecipesPanel } from "@/components/dashboard/fnb/menu-panels";
import { CustomerPanel, InventoryPanel, ProcurementPanel, ReportsPanel, SettingsPanel, SupplierPanel, WastagePanel } from "@/components/dashboard/fnb/stock-panels";

export type Tab = "overview" | "kitchen" | "orders" | "pos" | "tables" | "menu" | "recipes" | "inventory" | "procurement" | "suppliers" | "customers" | "wastage" | "reports" | "settings";

const groups: Array<{ title: string; items: Array<{ id: Tab; label: string; icon: any }> }> = [
  { title: "Service", items: [{ id: "overview", label: "Today", icon: Home }, { id: "pos", label: "Register", icon: ShoppingBag }, { id: "kitchen", label: "Kitchen", icon: ChefHat }, { id: "orders", label: "Orders", icon: ClipboardList }, { id: "tables", label: "Reservations", icon: CalendarDays }] },
  { title: "Menu", items: [{ id: "menu", label: "Menu", icon: UtensilsCrossed }, { id: "recipes", label: "Recipes & cost", icon: BookOpen }] },
  { title: "Stock", items: [{ id: "inventory", label: "Stock", icon: Boxes }, { id: "procurement", label: "Purchasing", icon: FileSignature }, { id: "suppliers", label: "Suppliers", icon: Truck }, { id: "wastage", label: "Waste", icon: Trash2 }] },
  { title: "Business", items: [{ id: "customers", label: "Customers", icon: Users }, { id: "reports", label: "Reports", icon: BarChart3 }, { id: "settings", label: "Settings", icon: Settings2 }] },
];
const all = groups.flatMap((g) => g.items);
const bottom: Tab[] = ["overview", "pos", "kitchen", "menu"];

export function FnbWorkspace({ slug, data }: { slug: string; data: any }) {
  setFnbCurrency(data.currency || "NGN");
  const [tab, setTab] = useState<Tab>("overview");
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<any>(null);
  const [recipeFocus, setRecipeFocus] = useState<string | null>(null);

  const loadPos = async () => {
    if (pos) return;
    const [catalog, summary, openTabs, inHouseRooms] = await Promise.all([getPosCatalog(slug), getPosDailySummary(slug), getOpenPosTabs(slug), getInHouseReservations(slug)]);
    setPos({ catalog, summary, openTabs, inHouseRooms, commissionRatePercent: data.posCommissionRatePercent ?? 8 });
  };
  const go = (next: Tab, dishId?: string) => {
    setRecipeFocus(dishId ?? null);
    setTab(next); setSheet(false);
    try { history.replaceState(null, "", `#${next}`); } catch {}
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    if (next === "pos") void loadPos();
  };
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (all.some((x) => x.id === h) && h !== "overview") { setTab(h); if (h === "pos") void loadPos(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The tab list lives in this component's state, so re-read it after a sale or a settlement.
  const refreshTabs = async () => { const openTabs = await getOpenPosTabs(slug); setPos((p: any) => (p ? { ...p, openTabs } : p)); };

  const activeTickets = data.metrics.activeOrders as number;
  const current = all.find((x) => x.id === tab)!;
  const moreActive = !bottom.includes(tab);

  return <div className="bn-fnb min-h-screen bg-[var(--bn-admin-page)] text-[var(--bn-admin-text)]">
    <style>{`.bn-fnb{--fnb-warn:#b45309;--fnb-info:#1d4ed8}html.bn-admin-dark .bn-fnb{--fnb-warn:#fbbf24;--fnb-info:#93c5fd}`}</style>
    <header className="sticky top-0 z-30 border-b border-[var(--bn-admin-border)] bg-[color-mix(in_srgb,var(--bn-admin-surface)_92%,transparent)] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:px-7">
        <a href={`/store/${slug}/admin/apps`} aria-label="Back to Apps" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--bn-admin-border)] text-[var(--bn-admin-text)]"><ArrowLeft className="h-4 w-4" /></a>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold leading-tight text-[var(--bn-admin-text-strong)]">{data.storeName}</p><p className="truncate text-[11px] leading-tight text-[var(--bn-admin-muted)]">Restaurant · {current.label}</p></div>
        <button onClick={() => go("pos")} className="shrink-0"><Chip tone={data.currentShift ? "ok" : "mute"} dot>{data.currentShift ? "Shift open" : "No shift"}</Chip></button>
        <button onClick={() => setSheet(true)} aria-label="All sections" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--bn-admin-border)] text-[var(--bn-admin-text)] lg:hidden"><LayoutGrid className="h-4 w-4" /></button>
      </div>
    </header>

    <div className="flex">
      <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-60 shrink-0 self-start overflow-y-auto border-r border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-3 lg:block">
        {groups.map((g) => <div key={g.title} className="mb-4"><p className="px-3 pb-1.5 text-[11px] font-bold text-[var(--bn-admin-muted)]">{g.title}</p>{g.items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`mb-0.5 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold transition ${tab === id ? "bg-[var(--bn-admin-active)] text-white" : "text-[var(--bn-admin-text)] hover:bg-[var(--bn-admin-surface-2)]"}`}><Icon className="h-4 w-4" /><span className="flex-1">{label}</span>{id === "kitchen" && activeTickets > 0 && <span className={`rounded-full px-1.5 text-[10px] font-extrabold ${tab === id ? "bg-white/25" : "bg-[var(--bn-admin-active)] text-white"}`}>{activeTickets}</span>}</button>)}</div>)}
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-7"><div className="mx-auto max-w-6xl">
        {tab === "overview" && <OverviewPanel slug={slug} data={data} go={go} />}
        {tab === "kitchen" && <KitchenPanel slug={slug} orders={data.orders} />}
        {tab === "orders" && <OrdersPanel orders={data.orders} />}
        {tab === "pos" && (pos ? <PosPanel slug={slug} pos={pos} currentShift={data.currentShift} recentShifts={data.recentShifts} refreshTabs={refreshTabs} /> : <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--bn-admin-muted)]">Opening the register…</div>)}
        {tab === "tables" && <TablesPanel reservations={data.reservations} />}
        {tab === "menu" && <MenuPanel slug={slug} products={data.products} inventory={data.inventory} role={data.role} go={go} />}
        {tab === "recipes" && <RecipesPanel key={recipeFocus ?? "none"} initialId={recipeFocus} slug={slug} products={data.products} inventory={data.inventory} role={data.role} />}
        {tab === "inventory" && <InventoryPanel slug={slug} data={data} />}
        {tab === "procurement" && <ProcurementPanel slug={slug} purchaseOrders={data.purchaseOrders} />}
        {tab === "suppliers" && <SupplierPanel slug={slug} suppliers={data.suppliers} />}
        {tab === "customers" && <CustomerPanel customers={data.customers} />}
        {tab === "wastage" && <WastagePanel slug={slug} data={data} />}
        {tab === "reports" && <ReportsPanel data={data} />}
        {tab === "settings" && <SettingsPanel slug={slug} role={data.role} mode={data.mode} />}
      </div></main>
    </div>

    {/* Phone bottom bar (hidden on the register, which has its own cart bar) */}
    {tab !== "pos" && <nav aria-label="FnB sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--bn-admin-border)] bg-[color-mix(in_srgb,var(--bn-admin-surface)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {bottom.map((id) => { const it = all.find((x) => x.id === id)!; const Icon = it.icon; const on = tab === id; return <button key={id} onClick={() => go(id)} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold ${on ? "text-[var(--bn-admin-active)]" : "text-[var(--bn-admin-muted)]"}`}><span className="relative"><Icon className="h-5 w-5" />{id === "kitchen" && activeTickets > 0 && <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--bn-admin-danger)] px-1 text-[9px] font-extrabold text-white">{activeTickets}</span>}</span>{it.label}</button>; })}
        <button onClick={() => setSheet(true)} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-bold ${moreActive ? "text-[var(--bn-admin-active)]" : "text-[var(--bn-admin-muted)]"}`}><LayoutGrid className="h-5 w-5" />More</button>
      </div>
    </nav>}

    {sheet && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[var(--bn-admin-surface)] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--bn-admin-border)]" />
        <div className="mb-2 flex items-center justify-between"><p className="text-base font-extrabold text-[var(--bn-admin-text-strong)]">All sections</p><button onClick={() => setSheet(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bn-admin-surface-2)]"><X className="h-4 w-4" /></button></div>
        {groups.map((g) => <div key={g.title} className="mt-4"><p className="mb-2 text-[11px] font-bold text-[var(--bn-admin-muted)]">{g.title}</p><div className="grid grid-cols-3 gap-2">{g.items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border px-1 text-center text-xs font-bold ${tab === id ? "border-transparent bg-[var(--bn-admin-active)] text-white" : "border-[var(--bn-admin-border)] text-[var(--bn-admin-text)]"}`}><Icon className="h-5 w-5" />{label}</button>)}</div></div>)}
      </div>
    </div>}
  </div>;
}
