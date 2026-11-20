"use client";

import { useEffect, useState } from "react";
import { BookOpen, Boxes, ChefHat, Home, Settings2, Trash2 } from "lucide-react";
import { setFnbCurrency } from "@/components/dashboard/fnb/ui";
import { AppShell, type NavGroup } from "@/components/dashboard/fnb/shell";
import { KitchenOverviewPanel, KitchenPanel } from "@/components/dashboard/fnb/service-panels";
import { RecipesPanel } from "@/components/dashboard/fnb/menu-panels";
import { InventoryPanel, SettingsPanel, WastagePanel } from "@/components/dashboard/fnb/stock-panels";

export type KitchenTab = "overview" | "kitchen" | "recipes" | "inventory" | "wastage" | "settings";

const groups: Array<NavGroup<KitchenTab>> = [
  { title: "Kitchen", items: [{ id: "overview", label: "Today", icon: Home }, { id: "kitchen", label: "Tickets", icon: ChefHat }, { id: "recipes", label: "Recipes & cost", icon: BookOpen }] },
  { title: "Ingredients", items: [{ id: "inventory", label: "Ingredient stock", icon: Boxes }, { id: "wastage", label: "Waste", icon: Trash2 }] },
  { title: "Setup", items: [{ id: "settings", label: "Settings", icon: Settings2 }] },
];
const all = groups.flatMap((g) => g.items);

export function KitchenWorkspace({ slug, data }: { slug: string; data: any }) {
  setFnbCurrency(data.currency || "NGN");
  const [tab, setTab] = useState<KitchenTab>("overview");
  const [dish, setDish] = useState<string | null>(null);
  const go = (next: KitchenTab) => {
    setTab(next);
    try { history.replaceState(null, "", `#${next}`); } catch {}
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as KitchenTab;
    const d = new URLSearchParams(window.location.search).get("dish");
    if (d) setDish(d);
    if (all.some((x) => x.id === h) && h !== "overview") setTab(h);
  }, []);
  return <AppShell slug={slug} title={data.storeName} appLabel="Kitchen" groups={groups} bottom={["overview", "kitchen", "recipes", "inventory"]} tab={tab} go={go} badges={{ kitchen: data.metrics.activeOrders }}>
    {tab === "overview" && <KitchenOverviewPanel data={data} go={go} />}
    {tab === "kitchen" && <KitchenPanel slug={slug} orders={data.orders} />}
    {tab === "recipes" && <RecipesPanel key={dish ?? "none"} initialId={dish} slug={slug} products={data.products} inventory={data.inventory} role={data.role} />}
    {tab === "inventory" && <InventoryPanel slug={slug} data={data} />}
    {tab === "wastage" && <WastagePanel slug={slug} data={data} />}
    {tab === "settings" && <SettingsPanel slug={slug} role={data.role} mode={data.mode} />}
  </AppShell>;
}
