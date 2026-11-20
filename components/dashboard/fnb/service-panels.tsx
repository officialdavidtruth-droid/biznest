"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChefHat, ClipboardCheck, Clock3, DollarSign, PackageCheck, Play, ShoppingBag, Users, Boxes } from "lucide-react";
import { toast } from "sonner";
import { advanceFnbOrderStatus } from "@/lib/actions/fnb";
import { Avatar, Chip, Empty, Page, Section, Segmented, Stat, btnGhost, btnPrimary, card, date, itemName, label, minutesAgo, money, orderRef, statusTone, time, toneStyle, type Tone } from "./ui";

const ACTIVE = ["QUEUED", "STARTED", "READY", "EXPO"];

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function where(o: any) { return `${o.channel === "POS" ? "In person" : label(String(o.channel || "Online"))}${o.fnbOrderType ? ` · ${label(o.fnbOrderType)}` : ""}${o.fnbTableLabel ? ` · ${o.fnbTableLabel}` : ""}`; }

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
