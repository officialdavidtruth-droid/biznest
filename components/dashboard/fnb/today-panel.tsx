"use client";

import Link from "next/link";
import { ChefHat, QrCode, ShoppingBag } from "lucide-react";
import { Avatar, Chip, Page, Section, Stat, btnGhost, btnPrimary, card, date, itemName, label, money, statusTone, time } from "./ui";
import { ShiftControl } from "./service-panels";

/** FnB's own "Today": shifts and table service. Menu, POS, orders, customers and reports live on the main dashboard. */
export function FnbTodayPanel({ slug, data, go, kitchenInstalled }: { slug: string; data: any; go: (id: any) => void; kitchenInstalled: boolean }) {
  const m = data.metrics;
  const dineIn: any[] = (data.orders as any[]).filter((o) => o.fnbOrderType === "DINE_IN" || o.fnbTableLabel);
  return <Page title="Today" sub={`${data.storeName} · ${date(new Date())}`} action={<Link href={`/store/${slug}/admin/pos`} className={btnPrimary}><ShoppingBag className="h-4 w-4" />Open register</Link>}>
    <ShiftControl slug={slug} currentShift={data.currentShift} recentShifts={data.recentShifts} />
    <div className="grid grid-cols-2 gap-3">
      <Stat icon={ShoppingBag} label="Sales today" value={money(m.revenue)} sub={`${m.ordersToday} orders`} />
      <Stat icon={QrCode} label="Table orders" value={dineIn.length} sub="Dine-in today" tone="info" />
    </div>
    <Section title="Table orders today" right={<button onClick={() => go("tables")} className="text-xs font-bold text-[var(--bn-admin-active)]">Manage tables</button>}>
      {dineIn.length === 0 ? <p className="text-sm text-[var(--bn-admin-muted)]">Dine-in orders show up here with their table, whether rung up at the register or placed by scanning a table's QR code.</p> : <div className="divide-y divide-[var(--bn-admin-border-soft)]">{dineIn.slice(0, 8).map((o) => <div key={o.id} className="flex items-center gap-3 py-2.5"><Avatar name={o.fnbTableLabel || "T"} tone={statusTone(o.kitchenStatus)} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{o.fnbTableLabel || "No table"}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{o.items?.[0] ? itemName(o.items[0]) : "Order"}{o.items?.length > 1 ? ` +${o.items.length - 1}` : ""} · {time(o.createdAt)}</p></div><div className="text-right"><p className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{money(Number(o.total))}</p><Chip tone={statusTone(o.kitchenStatus)}>{label(o.kitchenStatus)}</Chip></div></div>)}</div>}
    </Section>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Link href={`/store/${slug}/admin/orders`} className={`${btnGhost} justify-center`}>Orders</Link>
      <Link href={`/store/${slug}/admin/products`} className={`${btnGhost} justify-center`}>Menu &amp; categories</Link>
      <Link href={kitchenInstalled ? `/store/${slug}/admin/kitchen` : `/store/${slug}/admin/apps`} className={`${btnGhost} justify-center`}><ChefHat className="h-4 w-4" />{kitchenInstalled ? "Kitchen" : "Add Kitchen"}</Link>
    </div>
  </Page>;
}
