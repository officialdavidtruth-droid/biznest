"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3,
  DollarSign, Menu as MenuIcon, Settings2, ShoppingBag, Users, UtensilsCrossed,
  Play, Square, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { endFnbShift, startFnbShift } from "@/lib/actions/fnb";
import { PosRegister } from "@/components/dashboard/pos-register";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import type { FnbRotationMode } from "@/lib/fnb-settings";

function money(n: number) { return `₦${Number(n || 0).toLocaleString()}`; }
function date(v: string | Date) { return new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
function time(v: string | Date) { return new Date(v).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }

type Tab = "pos" | "menu" | "tables" | "customers" | "reports" | "settings";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "pos", label: "POS", icon: ShoppingBag },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "tables", label: "Tables & Reservations", icon: CalendarDays },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function FnbWorkspace({ slug, data }: { slug: string; data: any }) {
  const [tab, setTab] = useState<Tab>("pos");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (next: Tab) => { setTab(next); setMobileOpen(false); };

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-7">
        <button className="rounded-lg border border-slate-700 p-2 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open FnB menu"><MenuIcon className="h-4 w-4" /></button>
        <Link href={`/store/${slug}/admin/apps`} className="hidden items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white lg:flex"><ArrowLeft className="h-4 w-4" /> Apps</Link>
        <div className="hidden h-5 w-px bg-slate-800 lg:block" />
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">BizNest FnB</p><p className="truncate text-sm font-bold">{data.storeName} · Restaurant Operations</p></div>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400 sm:flex"><ShieldCheck className="h-3.5 w-3.5 text-blue-400" /> Staff operations</div>
        <button onClick={() => navigate("pos")} className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/10">Open POS</button>
      </div>
    </header>
    <div className="flex">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-slate-950 pt-16 transition-transform lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:w-64 lg:translate-x-0 lg:self-start lg:pt-0`}>
        <nav className="h-full overflow-y-auto p-3">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${tab === id ? "bg-orange-500 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-7">
        {tab === "pos" && <PosPanel slug={slug} pos={data.pos} currentShift={data.currentShift} recentShifts={data.recentShifts} />}
        {tab === "menu" && <MenuPanel slug={slug} products={data.products} role={data.role} />}
        {tab === "tables" && <LinkPanel title="Tables & Reservations" description="Open the restaurant reservation and table workflow while keeping bookings in the core BizNest system." href={`/store/${slug}/admin/bookings`} label="Open Tables & Reservations" icon={CalendarDays} />}
        {tab === "customers" && <CustomerPanel slug={slug} customers={data.customers} />}
        {tab === "reports" && <Reports data={data} />}
        {tab === "settings" && <SettingsPanel slug={slug} role={data.role} />}
      </main>
    </div>
  </div>;
}

function PosPanel({ slug, pos, currentShift, recentShifts }: { slug: string; pos?: { catalog: any[]; commissionRatePercent: number; summary: any }; currentShift: any; recentShifts: any[] }) {
  if (!pos) return <EmptyState title="POS unavailable" text="Your account does not have permission to use the restaurant register." />;
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-orange-400">Restaurant POS</p><h1 className="mt-1 text-2xl font-bold">Point of Sale</h1><p className="mt-1 text-sm text-slate-400">Every sale is attributed to the operator's active shift.</p></div>
      <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-3"><Stat label="Today" value={`${pos.summary.salesCount} sales`} /><Stat label="Today" value={money(pos.summary.totalAmount)} /><Stat label="Shift" value={currentShift ? `${currentShift.salesCount} sales` : "Not started"} /></div>
    </div>
    <ShiftControl slug={slug} currentShift={currentShift} recentShifts={recentShifts} />
    {currentShift ? <PosRegister slug={slug} catalog={pos.catalog} commissionRatePercent={pos.commissionRatePercent} /> : <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-8 text-center"><Clock3 className="mx-auto h-8 w-8 text-orange-400" /><h2 className="mt-3 text-lg font-bold">Start your shift to begin selling</h2><p className="mx-auto mt-1 max-w-md text-sm text-slate-400">POS sales are locked until the signed-in operator starts a shift. This prevents sales from being recorded against the wrong staff member.</p></div>}
  </div>;
}

function ShiftControl({ slug, currentShift, recentShifts }: { slug: string; currentShift: any; recentShifts: any[] }) {
  const [busy, start] = useTransition();
  const run = (action: "start" | "end") => start(async () => {
    const result = action === "start" ? await startFnbShift(slug) : await endFnbShift(slug);
    if (!result.success) toast.error(result.error);
    else { toast.success(action === "start" || !("salesCount" in result.data) ? "Shift started." : `Shift ended — ${result.data.salesCount} sales, ${money(result.data.salesTotal)}.`); window.location.reload(); }
  });
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${currentShift ? "bg-blue-500/15 text-blue-400" : "bg-slate-800 text-slate-400"}`}>{currentShift ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
        <div className="min-w-0"><p className="text-xs font-bold">{currentShift ? "Shift is open" : "No active shift"}</p>{currentShift ? <p className="mt-1 text-[11px] text-slate-400">Started {date(currentShift.startedAt)} at {time(currentShift.startedAt)} · {currentShift.salesCount} sales · {money(currentShift.salesTotal)}</p> : <p className="mt-1 text-[11px] text-slate-400">Start a shift before accepting POS orders.</p>}</div>
      </div>
      <button disabled={busy} onClick={() => run(currentShift ? "end" : "start")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50 ${currentShift ? "bg-blue-600 hover:bg-blue-500" : "bg-orange-500 hover:bg-orange-400"}`}>
        {currentShift ? <><Square className="h-3.5 w-3.5" /> End Shift</> : <><Play className="h-3.5 w-3.5" /> Start Shift</>}
      </button>
    </div>
    {recentShifts.length > 0 && <div className="mt-4 border-t border-slate-800 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent operator shifts</p><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{recentShifts.slice(0, 4).map((s: any) => <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"><p className="truncate text-[11px] font-semibold">{s.staffUser?.name || s.staffUser?.email || "Operator"}</p><p className="mt-1 text-[10px] text-slate-500">{date(s.startedAt)} · {s.status === "OPEN" ? "Open" : `Ended ${s.endedAt ? time(s.endedAt) : ""}`}</p><p className="mt-1 text-[10px] text-slate-400">{s.salesCount} sales · {money(s.salesTotal)}</p></div>)}</div></div>}
  </section>;
}

function MenuPanel({ slug, products, role }: { slug: string; products: any[]; role: string }) {
  const canEditCatalog = role === "OWNER" || role === "MANAGER" || role === "PLATFORM_STAFF";
  return <div className="space-y-5"><SectionTitle title="Menu" description="Live menu data from the BizNest catalog. Staff can view and sell items, but cannot edit the menu." action={canEditCatalog ? <Link href={`/store/${slug}/admin/products`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">Manage Catalog</Link> : <span className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400">Staff: View Only</span>} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{products.slice(0, 60).map((p: any) => <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{p.name}</p><p className="mt-1 text-xs text-slate-400">{money(p.price)} · {p.inventory ? `${p.inventory.quantity} in stock` : "No stock tracking"}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${p.inventory && p.inventory.quantity === 0 ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : p.isPublished ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>{p.inventory && p.inventory.quantity === 0 ? "Unavailable" : p.isPublished ? "Published" : "Hidden"}</span></div><p className="mt-3 text-[10px] text-slate-500">{extractFnbRecipe(p.attributes) ? "Recipe configured" : "No recipe configured"}</p></div>)}</div></div>;
}

function CustomerPanel({ slug, customers }: { slug: string; customers: any[] }) { return <div className="space-y-5"><SectionTitle title="Customers" description="Live customer profiles connected to restaurant orders and CRM." action={<Link href={`/store/${slug}/admin/customers`} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200">Open Customer List</Link>} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{customers.map((c: any) => <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-sm font-bold">{c.name}</p><p className="mt-1 text-xs text-slate-400">{c.phone || c.email || "No contact"}</p><p className="mt-3 text-[10px] text-slate-500">Updated {date(c.updatedAt)}</p></div>)}{customers.length === 0 && <EmptyState title="No customers yet" text="Customer profiles created from the store and POS will appear here." />}</div></div>; }

function Reports({ data }: { data: any }) { const m = data.metrics; const posSales = data.orders.filter((o: any) => o.channel === "POS"); const posRevenue = posSales.reduce((s: number, o: any) => s + Number(o.total), 0); return <div className="space-y-5"><SectionTitle title="Reports" description="Live restaurant performance from BizNest orders, POS sales, customers and reservations." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={DollarSign} label="Today's sales" value={money(m.revenue)} sub="All completed store orders" /><Metric icon={ShoppingBag} label="POS sales" value={money(posRevenue)} sub={`${posSales.length} POS orders today`} /><Metric icon={Users} label="Customers" value={data.customers.length} sub="Recent customer profiles" /><Metric icon={CalendarDays} label="Reservations" value={data.reservations} sub="Today" /></div><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-sm font-bold">Current shift</h2>{data.currentShift ? <div className="mt-4 space-y-3"><ReportRow label="Started" value={`${date(data.currentShift.startedAt)} ${time(data.currentShift.startedAt)}`} /><ReportRow label="Sales" value={`${data.currentShift.salesCount}`} /><ReportRow label="Shift revenue" value={money(data.currentShift.salesTotal)} /></div> : <p className="mt-4 text-xs text-slate-400">No open shift for the signed-in operator.</p>}</section><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-sm font-bold">Menu & operations</h2><div className="mt-4 space-y-3"><ReportRow label="Menu items" value={`${data.products.length}`} /><ReportRow label="Recipes configured" value={`${m.recipeCount}`} /><ReportRow label="Active orders" value={`${m.activeOrders}`} /><ReportRow label="POS orders today" value={`${posSales.length}`} /></div></section></div></div>; }

function SettingsPanel({ slug, role }: { slug: string; role: string }) {
  const canManage = role === "OWNER" || role === "MANAGER" || role === "PLATFORM_STAFF";
  return <div className="space-y-5"><SectionTitle title="FnB Settings" description="Restaurant service settings that belong to the FnB operations plugin." /><section className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-5 w-5 text-orange-400" /><div><h2 className="text-sm font-bold">Plugin access</h2><p className="mt-1 text-xs leading-5 text-slate-400">POS, Menu, Tables & Reservations, Customers, Reports and these plugin settings are available through the FnB operations permission assigned by the store administrator.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-bold">Menu protection</p><p className="mt-1 text-[11px] text-slate-400">Staff accounts can view and sell menu items but cannot edit the catalog.</p><span className="mt-3 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">Protected</span></div><div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-bold">Shift accountability</p><p className="mt-1 text-[11px] text-slate-400">Every POS operator must start a shift before selling, and every sale is linked to that shift.</p><span className="mt-3 inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-300">Enabled</span></div></div>{canManage && <Link href={`/store/${slug}/admin/staff`} className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white">Manage Staff Access</Link>}</section></div>; }
function LinkPanel({ title, description, href, label, icon: Icon }: any) { return <div className="mx-auto flex min-h-[55vh] max-w-3xl items-center"><section className="w-full rounded-3xl border border-slate-800 bg-slate-900/60 p-7 text-center shadow-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400"><Icon className="h-7 w-7" /></span><h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{description}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-bold text-white">{label}<ArrowRight className="h-4 w-4" /></Link></section></div>; }
function SectionTitle({ title, description, action }: any) { return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p></div>{action}</div>; }
function Metric({ icon: Icon, label, value, sub }: any) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-400">{label}</span><Icon className="h-4 w-4 text-orange-400" /></div><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-[10px] text-slate-500">{sub}</p></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-bold text-white">{value}</p></div>; }
function ReportRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2.5 text-xs"><span className="text-slate-400">{label}</span><span className="font-bold">{value}</span></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></div>; }