"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, ClipboardList, Home, ShoppingBag, Users, UtensilsCrossed } from "lucide-react";
import { getPosCatalog, getPosDailySummary } from "@/lib/actions/pos";
import { getOpenPosTabs } from "@/lib/actions/pos-tabs";
import { getInHouseReservations } from "@/lib/actions/folio";
import { setFnbCurrency } from "@/components/dashboard/fnb/ui";
import { AppShell, type NavGroup } from "@/components/dashboard/fnb/shell";
import { OrdersPanel, OverviewPanel, PosPanel, TablesPanel } from "@/components/dashboard/fnb/service-panels";
import { MenuPanel } from "@/components/dashboard/fnb/menu-panels";
import { CustomerPanel, ReportsPanel } from "@/components/dashboard/fnb/stock-panels";

export type Tab = "overview" | "orders" | "pos" | "tables" | "menu" | "customers" | "reports";

const groups: Array<NavGroup<Tab>> = [
  { title: "Service", items: [{ id: "overview", label: "Today", icon: Home }, { id: "pos", label: "Register", icon: ShoppingBag }, { id: "orders", label: "Orders", icon: ClipboardList }, { id: "tables", label: "Reservations", icon: CalendarDays }] },
  { title: "Menu", items: [{ id: "menu", label: "Menu", icon: UtensilsCrossed }] },
  { title: "Business", items: [{ id: "customers", label: "Customers", icon: Users }, { id: "reports", label: "Reports", icon: BarChart3 }] },
];
const all = groups.flatMap((g) => g.items);

export function FnbWorkspace({ slug, data, kitchenInstalled = false }: { slug: string; data: any; kitchenInstalled?: boolean }) {
  setFnbCurrency(data.currency || "NGN");
  const [tab, setTab] = useState<Tab>("overview");
  const [pos, setPos] = useState<any>(null);
  const kitchenHref = `/store/${slug}/admin/kitchen`;

  const loadPos = async () => {
    if (pos) return;
    const [catalog, summary, openTabs, inHouseRooms] = await Promise.all([getPosCatalog(slug), getPosDailySummary(slug), getOpenPosTabs(slug), getInHouseReservations(slug)]);
    setPos({ catalog, summary, openTabs, inHouseRooms, commissionRatePercent: data.posCommissionRatePercent ?? 8 });
  };
  const go = (next: Tab) => {
    setTab(next);
    try { history.replaceState(null, "", `#${next}`); } catch {}
    window.scrollTo({ top: 0 });
    if (next === "pos") void loadPos();
  };
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (all.some((x) => x.id === h) && h !== "overview") { setTab(h); if (h === "pos") void loadPos(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The tab list lives in this component's state, so re-read it after a sale or a settlement.
  const refreshTabs = async () => { const openTabs = await getOpenPosTabs(slug); setPos((p: any) => (p ? { ...p, openTabs } : p)); };

  return <AppShell slug={slug} title={data.storeName} appLabel="Restaurant" groups={groups} bottom={["overview", "pos", "orders", "menu"]} tab={tab} go={go} hideBottomOn={["pos"]}
    chip={{ text: data.currentShift ? "Shift open" : "No shift", tone: data.currentShift ? "ok" : "mute", onClick: () => go("pos") }}>
    {tab === "overview" && <OverviewPanel slug={slug} data={data} go={go} kitchenInstalled={kitchenInstalled} />}
    {tab === "orders" && <OrdersPanel orders={data.orders} />}
    {tab === "pos" && (pos ? <PosPanel slug={slug} pos={pos} currentShift={data.currentShift} recentShifts={data.recentShifts} refreshTabs={refreshTabs} /> : <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--bn-admin-muted)]">Opening the register…</div>)}
    {tab === "tables" && <TablesPanel reservations={data.reservations} />}
    {tab === "menu" && <MenuPanel slug={slug} products={data.products} inventory={data.inventory} role={data.role} kitchenInstalled={kitchenInstalled} kitchenHref={kitchenHref} />}
    {tab === "customers" && <CustomerPanel customers={data.customers} />}
    {tab === "reports" && <ReportsPanel data={data} kitchenInstalled={kitchenInstalled} />}
  </AppShell>;
}
