"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChefHat, ClipboardCheck, Clock3, DollarSign, PackageCheck, Play, ShoppingBag, Users, Boxes } from "lucide-react";
import { toast } from "sonner";
import { advanceFnbOrderStatus, endFnbShift, startFnbShift } from "@/lib/actions/fnb";
import { PosRegister } from "@/components/dashboard/pos-register";
import { PosOpenTabs } from "@/components/dashboard/pos-open-tabs";
import { Avatar, Chip, Empty, Page, Section, Segmented, Stat, btnGhost, btnPrimary, card, date, itemName, label, minutesAgo, money, orderRef, statusTone, time, toneStyle, type Tone } from "./ui";

const ACTIVE = ["QUEUED", "STARTED", "READY", "EXPO"];

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function where(o: any) { return `${o.channel === "POS" ? "In person" : label(String(o.channel || "Online"))}${o.fnbOrderType ? ` · ${label(o.fnbOrderType)}` : ""}${o.fnbTableLabel ? ` · ${o.fnbTableLabel}` : ""}`; }

/* ───────────── Overview (front of house) ───────────── */
export function OverviewPanel({ slug, data, go, kitchenInstalled }: { slug: string; data: any; go: (id: any) => void; kitchenInstalled: boolean }) {
  const m = data.metrics;
  const orders: any[] = data.orders;
  const avg = m.ordersToday > 0 ? m.revenue / m.ordersToday : 0;
  const openTickets = orders.filter((o) => ACTIVE.includes(o.kitchenStatus)).length;
  return <Page title="Today" sub={`${data.storeName} · ${date(new Date())}`} action={<button onClick={() => go("pos")} className={btnPrimary}><ShoppingBag className="h-4 w-4" />Open register</button>}>
    <div className="overflow-hidden rounded-3xl p-5 text-white sm:p-6" style={{ background: "linear-gradient(135deg, var(--bn-admin-active-dark), var(--bn-admin-active) 70%, #22c55e)" }}>
      <p className="text-xs font-semibold text-white/80">Sales so far today</p>
      <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight sm:text-5xl">{money(m.revenue)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-white/15 px-3 py-2"><p className="text-white/75">Orders</p><p className="mt-0.5 text-base font-extrabold">{m.ordersToday}</p></div>
        <div className="rounded-xl bg-white/15 px-3 py-2"><p className="text-white/75">Avg order</p><p className="mt-0.5 truncate text-base font-extrabold">{money(avg)}</p></div>
        <div className="rounded-xl bg-white/15 px-3 py-2"><p className="text-white/75">Bookings</p><p className="mt-0.5 text-base font-extrabold">{m.reservationsToday}</p></div>
      </div>
    </div>

    {kitchenInstalled
      ? <a href={`/store/${slug}/admin/kitchen`} className={`${card} flex items-center gap-3 p-4`}><span style={toneStyle(openTickets ? "warn" : "ok")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"><ChefHat className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">Kitchen Management</p><p className="text-xs text-[var(--bn-admin-muted)]">{openTickets ? `${openTickets} ticket${openTickets > 1 ? "s" : ""} in the kitchen` : "No open tickets"}</p></div><span className="text-xs font-bold text-[var(--bn-admin-active)]">Open</span></a>
      : <a href={`/store/${slug}/admin/apps`} className={`${card} flex items-center gap-3 p-4`}><span style={toneStyle("info")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"><ChefHat className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">Add Kitchen Management</p><p className="text-xs text-[var(--bn-admin-muted)]">Kitchen screen, recipes and food cost, stock, purchasing and waste.</p></div><span className="text-xs font-bold text-[var(--bn-admin-active)]">Get app</span></a>}

    <Section title="Latest orders" right={<button onClick={() => go("orders")} className="text-xs font-bold text-[var(--bn-admin-active)]">See all</button>}>
      {orders.length === 0 ? <p className="text-sm text-[var(--bn-admin-muted)]">Orders show up here as soon as the first sale is made.</p> : <div className="divide-y divide-[var(--bn-admin-border-soft)]">{orders.slice(0, 5).map((o) => <div key={o.id} className="flex items-center gap-3 py-2.5"><Avatar name={o.items?.[0] ? itemName(o.items[0]) : "O"} tone={statusTone(o.kitchenStatus)} /><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold text-[var(--bn-admin-text-strong)]">{orderRef(o)} · {o.items.length} item{o.items.length === 1 ? "" : "s"}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{where(o)} · {time(o.createdAt)}</p></div><div className="text-right"><p className="text-[13px] font-extrabold text-[var(--bn-admin-text-strong)]">{money(o.total)}</p>{kitchenInstalled && <Chip tone={statusTone(o.kitchenStatus)}>{label(o.kitchenStatus)}</Chip>}</div></div>)}</div>}
    </Section>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Catalog", "products"], ["Staff", "staff"], ["Bookings", "bookings"]].map(([t, p]) => <Link key={p} href={`/store/${slug}/admin/${p}`} className={`${btnGhost} justify-center`}>{t}</Link>)}</div>
  </Page>;
}

/* ───────────── Overview (kitchen management) ───────────── */
export function KitchenOverviewPanel({ data, go }: { data: any; go: (id: any) => void }) {
  const m = data.metrics;
  const now = useNow(60000);
  const active: any[] = data.orders.filter((o: any) => ACTIVE.includes(o.kitchenStatus));
  const stages: Array<{ id: string; text: string; tone: Tone }> = [{ id: "QUEUED", text: "New", tone: "info" }, { id: "STARTED", text: "Cooking", tone: "warn" }, { id: "READY", text: "Ready", tone: "ok" }, { id: "EXPO", text: "At pass", tone: "ok" }];
  const alerts: Array<{ tone: Tone; text: string; to: any }> = [];
  if (m.outOfStock > 0) alerts.push({ tone: "bad", text: `${m.outOfStock} ingredient${m.outOfStock > 1 ? "s" : ""} out of stock`, to: "inventory" });
  if (m.lowStock > 0) alerts.push({ tone: "warn", text: `${m.lowStock} item${m.lowStock > 1 ? "s" : ""} running low`, to: "inventory" });
  if (m.expired > 0) alerts.push({ tone: "bad", text: `${m.expired} expired batch${m.expired > 1 ? "es" : ""} to remove`, to: "wastage" });
  if (m.expiringSoon > 0) alerts.push({ tone: "warn", text: `${m.expiringSoon} batch${m.expiringSoon > 1 ? "es" : ""} expiring within 7 days`, to: "inventory" });
  if (m.recipeCount === 0) alerts.push({ tone: "info", text: "No recipes yet — add one to see food cost", to: "recipes" });
  const oldest = active.length ? Math.max(...active.map((o) => minutesAgo(o.createdAt, now))) : 0;
  return <Page title="Kitchen today" sub={`${data.storeName} · ${date(new Date())}`} action={<button onClick={() => go("kitchen")} className={btnPrimary}><ChefHat className="h-4 w-4" />Open tickets</button>}>
    <Section title="Kitchen right now" hint={active.length ? `Oldest ticket waiting ${oldest} min` : "No open tickets"}>
      <div className="grid grid-cols-4 gap-2">{stages.map((s) => { const n = active.filter((o) => o.kitchenStatus === s.id).length; return <button key={s.id} onClick={() => go("kitchen")} style={n ? toneStyle(s.tone) : undefined} className={`rounded-xl px-2 py-3 text-center ${n ? "" : "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-muted)]"}`}><p className="text-xl font-extrabold leading-none">{n}</p><p className="mt-1 text-[11px] font-bold">{s.text}</p></button>; })}</div>
    </Section>
    <Section title="Needs attention">
      {alerts.length === 0 ? <div className="flex items-center gap-2 text-sm text-[var(--bn-admin-muted)]"><CheckCircle2 className="h-4 w-4 text-[var(--bn-admin-active)]" />Stock and kitchen look healthy.</div> : <div className="space-y-2">{alerts.map((a, i) => <button key={i} onClick={() => go(a.to)} className="flex w-full items-center gap-3 rounded-xl bg-[var(--bn-admin-surface-2)] px-3 py-3 text-left"><span style={toneStyle(a.tone)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--bn-admin-text)]">{a.text}</span><span className="text-xs font-bold text-[var(--bn-admin-muted)]">View</span></button>)}</div>}
    </Section>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={Boxes} label="Stock value" value={money(m.stockValue)} sub={`${m.lowStock} low · ${m.outOfStock} out`} tone="info" />
      <Stat icon={ChefHat} label="Recipes" value={m.recipeCount} sub="Costed dishes" />
      <Stat icon={DollarSign} label="Waste logged" value={m.wasteUnits} sub="Units to date" tone="warn" />
      <Stat icon={PackageCheck} label="Open tickets" value={active.length} sub="In the kitchen" tone="warn" />
    </div>
  </Page>;
}

/* ───────────── Kitchen ───────────── */
const stations = ["All", "Hot Kitchen", "Grill", "Cold", "Drinks", "Pizza", "Dessert", "Expo"];
type NextStatus = "STARTED" | "READY" | "EXPO" | "SERVED";
const columns: Array<{ status: string; title: string; hint: string; icon: any; tone: Tone; next: { status: NextStatus; label: string } }> = [
  { status: "QUEUED", title: "New", hint: "Waiting to start", icon: Clock3, tone: "info", next: { status: "STARTED", label: "Start cooking" } },
  { status: "STARTED", title: "Cooking", hint: "In production", icon: ChefHat, tone: "warn", next: { status: "READY", label: "Mark ready" } },
  { status: "READY", title: "Ready", hint: "Waiting for the pass", icon: PackageCheck, tone: "ok", next: { status: "EXPO", label: "Send to pass" } },
  { status: "EXPO", title: "At the pass", hint: "Ready to serve", icon: CheckCircle2, tone: "ok", next: { status: "SERVED", label: "Mark served" } },
];

export function KitchenPanel({ slug, orders }: { slug: string; orders: any[] }) {
  const router = useRouter();
  const now = useNow();
  const [station, setStation] = useState("All");
  const [stage, setStage] = useState("QUEUED");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => router.refresh(), 8000); return () => clearInterval(t); }, [router]);
  const active = orders.filter((o) => ACTIVE.includes(o.kitchenStatus));
  const visible = station === "All" ? active : active.filter((o) => o.items.some((i: any) => (i.fnbStation || "Hot Kitchen") === station));
  const advance = (order: any, next: NextStatus) => {
    setPending(order.id);
    void (async () => {
      const r = await advanceFnbOrderStatus(slug, order.id, next);
      setPending(null);
      if (!r.success) toast.error(r.error); else { toast.success(next === "SERVED" ? "Order served" : `Moved to ${label(next)}`); router.refresh(); }
    })();
  };
  const ticket = (o: any, col: (typeof columns)[number]) => {
    const mins = minutesAgo(o.createdAt, now);
    const age: Tone = mins >= 20 ? "bad" : mins >= 10 ? "warn" : "ok";
    return <div key={o.id} className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--bn-admin-border-soft)] px-4 py-3">
        <div className="min-w-0"><p className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{orderRef(o)}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{where(o)}</p></div>
        <Chip tone={age} dot>{mins} min</Chip>
      </div>
      <ul className="space-y-1.5 px-4 py-3">{o.items.filter((i: any) => station === "All" || (i.fnbStation || "Hot Kitchen") === station).map((i: any, n: number) => <li key={n} className="flex items-center gap-3 text-[13px]"><span className="grid h-7 min-w-7 place-items-center rounded-lg bg-[var(--bn-admin-surface-2)] px-1.5 text-xs font-extrabold text-[var(--bn-admin-text-strong)]">{i.quantity}</span><span className="min-w-0 flex-1 truncate font-semibold text-[var(--bn-admin-text)]">{itemName(i)}</span><span className="shrink-0 text-[10px] font-semibold text-[var(--bn-admin-muted)]">{i.fnbStation || "Hot Kitchen"}</span></li>)}</ul>
      <div className="px-4 pb-4"><button disabled={pending === o.id} onClick={() => advance(o, col.next.status)} className={`${btnPrimary} w-full`}>{pending === o.id ? "Updating…" : col.next.label}</button></div>
    </div>;
  };
  const current = columns.find((c) => c.status === stage)!;
  return <Page title="Kitchen" sub="Live tickets from the register, online orders and tables. Refreshes every few seconds.">
    <Segmented scroll value={station} onChange={setStation} options={stations.map((s) => ({ id: s, label: s }))} />
    {/* Phone: one stage at a time */}
    <div className="space-y-4 lg:hidden">
      <div className="grid grid-cols-4 gap-1.5">{columns.map((c) => { const n = visible.filter((o) => o.kitchenStatus === c.status).length; const on = stage === c.status; return <button key={c.status} onClick={() => setStage(c.status)} style={on ? toneStyle(c.tone) : undefined} className={`rounded-xl border px-1 py-2.5 text-center ${on ? "border-transparent" : "border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] text-[var(--bn-admin-muted)]"}`}><p className="text-lg font-extrabold leading-none">{n}</p><p className="mt-1 text-[10.5px] font-bold">{c.title}</p></button>; })}</div>
      <div className="space-y-3">{visible.filter((o) => o.kitchenStatus === stage).map((o) => ticket(o, current))}{visible.filter((o) => o.kitchenStatus === stage).length === 0 && <Empty icon={current.icon} title={`Nothing in “${current.title}”`} text={current.hint} />}</div>
    </div>
    {/* Desktop: board */}
    <div className="hidden gap-4 lg:grid lg:grid-cols-4">{columns.map((c) => { const list = visible.filter((o) => o.kitchenStatus === c.status); const Icon = c.icon; return <section key={c.status} className="min-h-[320px] rounded-2xl bg-[var(--bn-admin-surface-2)] p-3"><div className="mb-3 flex items-center gap-2 px-1"><span style={toneStyle(c.tone)} className="grid h-7 w-7 place-items-center rounded-lg"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">{c.title}</p><p className="text-[11px] text-[var(--bn-admin-muted)]">{c.hint}</p></div><span className="rounded-full bg-[var(--bn-admin-surface)] px-2 py-0.5 text-xs font-extrabold">{list.length}</span></div><div className="space-y-3">{list.map((o) => ticket(o, c))}{list.length === 0 && <p className="rounded-xl border border-dashed border-[var(--bn-admin-border)] p-6 text-center text-xs text-[var(--bn-admin-muted)]">Nothing here</p>}</div></section>; })}</div>
  </Page>;
}

/* ───────────── Orders ───────────── */
export function OrdersPanel({ orders }: { orders: any[] }) {
  const [f, setF] = useState<"all" | "open" | "served">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = orders.filter((o) => f === "all" ? true : f === "open" ? ACTIVE.includes(o.kitchenStatus) : o.kitchenStatus === "SERVED");
  return <Page title="Orders" sub="Today's paid orders, newest first.">
    <Segmented value={f} onChange={setF} options={[{ id: "all", label: "All", count: orders.length }, { id: "open", label: "In kitchen", count: orders.filter((o) => ACTIVE.includes(o.kitchenStatus)).length }, { id: "served", label: "Served", count: orders.filter((o) => o.kitchenStatus === "SERVED").length }]} />
    <div className="space-y-2.5">{list.map((o) => { const open = openId === o.id; return <div key={o.id} className={`${card} overflow-hidden`}>
      <button onClick={() => setOpenId(open ? null : o.id)} className="flex w-full items-center gap-3 p-3.5 text-left">
        <Avatar name={o.items?.[0] ? itemName(o.items[0]) : "O"} tone={statusTone(o.kitchenStatus)} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{orderRef(o)}{o.posCustomerName ? ` · ${o.posCustomerName}` : ""}</p><p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{where(o)} · {time(o.createdAt)}</p></div>
        <div className="text-right"><p className="text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{money(o.total)}</p><Chip tone={statusTone(o.kitchenStatus)}>{label(o.kitchenStatus)}</Chip></div>
      </button>
      {open && <ul className="space-y-1.5 border-t border-[var(--bn-admin-border-soft)] bg-[var(--bn-admin-surface-2)] px-4 py-3">{o.items.map((i: any, n: number) => <li key={n} className="flex items-center gap-3 text-[13px]"><span className="grid h-6 min-w-6 place-items-center rounded-md bg-[var(--bn-admin-surface)] px-1 text-xs font-extrabold">{i.quantity}</span><span className="flex-1 truncate">{itemName(i)}</span><span className="text-[10px] text-[var(--bn-admin-muted)]">{i.fnbStation || "Hot Kitchen"}</span></li>)}</ul>}
    </div>; })}
    {list.length === 0 && <Empty icon={ClipboardCheck} title="No orders here yet" text="Paid orders from the register and online show up in this list." />}</div>
  </Page>;
}

/* ───────────── Tables & reservations ───────────── */
export function TablesPanel({ reservations }: { reservations: any[] }) {
  const guests = reservations.reduce((s, r) => s + (r.partySize || 1), 0);
  return <Page title="Reservations" sub="Today's bookings from the BizNest booking system.">
    <div className="grid grid-cols-2 gap-3"><Stat icon={CalendarDays} label="Bookings" value={reservations.length} sub="Today" tone="info" /><Stat icon={Users} label="Guests expected" value={guests} sub="Across all parties" /></div>
    <div className="space-y-2.5">{reservations.map((r) => <div key={r.id} className={`${card} flex items-center gap-3 p-3.5`}><div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-[var(--bn-admin-surface-2)] text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{time(r.scheduledAt)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{r.guestName || "Guest"}</p><p className="text-[11px] text-[var(--bn-admin-muted)]">Party of {r.partySize || 1}</p></div><Chip tone={statusTone(r.status)}>{label(r.status)}</Chip></div>)}
    {reservations.length === 0 && <Empty icon={CalendarDays} title="No reservations today" text="Bookings made on your storefront appear here." />}</div>
  </Page>;
}

/* ───────────── POS + shift ───────────── */
export function PosPanel({ slug, pos, currentShift, recentShifts, refreshTabs }: { slug: string; pos: any; currentShift: any; recentShifts: any[]; refreshTabs: () => void }) {
  return <Page title="Register" sub={currentShift ? "Every sale is linked to your open shift." : "Start your shift to unlock the register."}>
    <ShiftControl slug={slug} currentShift={currentShift} recentShifts={recentShifts} />
    {currentShift ? <><PosRegister slug={slug} catalog={pos.catalog} commissionRatePercent={pos.commissionRatePercent} inHouseRooms={pos.inHouseRooms ?? []} openTabs={pos.openTabs ?? []} onSaleComplete={refreshTabs} /><PosOpenTabs slug={slug} tabs={pos.openTabs ?? []} inHouseRooms={pos.inHouseRooms ?? []} onChanged={refreshTabs} /></> : <Empty icon={Clock3} title="Register is locked" text="Open a shift above, then you can ring up sales." />}
  </Page>;
}

export function ShiftControl({ slug, currentShift, recentShifts }: { slug: string; currentShift: any; recentShifts: any[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const run = () => start(async () => { const r = currentShift ? await endFnbShift(slug) : await startFnbShift(slug); if (!r.success) toast.error(r.error); else { toast.success(currentShift && "salesCount" in r.data ? `Shift ended — ${r.data.salesCount} sales, ${money(r.data.salesTotal)}.` : "Shift started."); router.refresh(); } });
  return <section className={`${card} p-4`}>
    <div className="flex items-center gap-3">
      <span style={toneStyle(currentShift ? "ok" : "mute")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl">{currentShift ? <Play className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">{currentShift ? "Shift open" : "No shift running"}</p><p className="truncate text-xs text-[var(--bn-admin-muted)]">{currentShift ? `Since ${time(currentShift.startedAt)} · ${currentShift.salesCount} sales · ${money(currentShift.salesTotal)}` : "Start one to accept sales."}</p></div>
      <button disabled={busy} onClick={run} className={currentShift ? btnGhost : btnPrimary}>{busy ? "…" : currentShift ? "End shift" : "Start shift"}</button>
    </div>
    {recentShifts.length > 0 && <><button onClick={() => setShowHistory((v) => !v)} className="mt-3 text-xs font-bold text-[var(--bn-admin-muted)]">{showHistory ? "Hide recent shifts" : "Recent shifts"}</button>
      {showHistory && <div className="mt-2 grid gap-2 sm:grid-cols-2">{recentShifts.slice(0, 4).map((s: any) => <div key={s.id} className="rounded-xl bg-[var(--bn-admin-surface-2)] px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-[var(--bn-admin-text-strong)]">{s.staffUser?.name || s.staffUser?.email || "Operator"}</p><Chip tone={s.status === "OPEN" ? "ok" : "mute"}>{s.status === "OPEN" ? "Open" : "Ended"}</Chip></div><p className="mt-1 text-[11px] text-[var(--bn-admin-muted)]">{date(s.startedAt)} · {s.salesCount} sales · {money(s.salesTotal)}</p></div>)}</div>}</>}
  </section>;
}
