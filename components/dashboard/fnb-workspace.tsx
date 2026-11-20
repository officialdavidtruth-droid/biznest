"use client";

import { useEffect, useState } from "react";
import { Home, QrCode } from "lucide-react";
import { setFnbCurrency } from "@/components/dashboard/fnb/ui";
import { AppShell, type NavGroup } from "@/components/dashboard/fnb/shell";
import { FnbTablesPanel } from "@/components/dashboard/fnb/tables-panel";
import { FnbTodayPanel } from "@/components/dashboard/fnb/today-panel";

// FnB is an add-on: shifts and table service only. Menu, POS, orders, customers,
// inventory and reports already live on the main dashboard and are not repeated here.
export type Tab = "overview" | "tables";

const groups: Array<NavGroup<Tab>> = [
  { title: "Service", items: [{ id: "overview", label: "Today", icon: Home }, { id: "tables", label: "Tables", icon: QrCode }] },
];
const all = groups.flatMap((g) => g.items);

export function FnbWorkspace({ slug, data, kitchenInstalled = false }: { slug: string; data: any; kitchenInstalled?: boolean }) {
  setFnbCurrency(data.currency || "NGN");
  const [tab, setTab] = useState<Tab>("overview");
  const go = (next: Tab) => {
    setTab(next);
    try { history.replaceState(null, "", `#${next}`); } catch {}
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (all.some((x) => x.id === h)) setTab(h);
  }, []);

  return <AppShell slug={slug} title={data.storeName} appLabel="Restaurant" groups={groups} bottom={["overview", "tables"]} tab={tab} go={go}
    chip={{ text: data.currentShift ? "Shift open" : "No shift", tone: data.currentShift ? "ok" : "mute", onClick: () => go("overview") }}>
    {tab === "overview" && <FnbTodayPanel slug={slug} data={data} go={go} kitchenInstalled={kitchenInstalled} />}
    {tab === "tables" && <FnbTablesPanel slug={slug} />}
  </AppShell>;
}
