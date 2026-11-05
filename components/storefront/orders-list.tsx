"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wallet, Layers, CheckCircle2, Package, XCircle, RotateCcw, AlertTriangle, ArrowUpRight, ShieldAlert, Truck, Repeat, ReceiptText, Check } from "lucide-react";
import { accentInk, readableOn } from "@/lib/account-theme";
import { PROGRESS_STEPS, filterOrders, itemsHeadline, orderPhase, progressIndex, statusBlurb, type OrderFilter } from "@/lib/orders-view";

export type OrderCardData = {
  id: string;
  shortId: string;
  status: string;
  currency: string;
  totalLabel: string;
  placedLabel: string; // "Today", "3 days ago" or a date
  placedTitle: string; // the full date, for hover and screen readers
  trackingUrl: string | null;
  deliveryLabel: string | null;
  riderName: string | null;
  hasDispute: boolean;
  canDispute: boolean;
  items: { name: string; image: string | null; qty: number; href: string }[];
};

const STATUS: Record<string, { label: string; icon: typeof Package; pill: string }> = {
  PAID: { label: "Paid", icon: CheckCircle2, pill: "bg-blue-50 text-blue-700 ring-blue-200" },
  IN_PROGRESS: { label: "Preparing", icon: Package, pill: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  DELIVERED: { label: "Delivered", icon: CheckCircle2, pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELLED: { label: "Cancelled", icon: XCircle, pill: "bg-slate-100 text-slate-600 ring-slate-200" },
  REFUNDED: { label: "Refunded", icon: RotateCcw, pill: "bg-slate-100 text-slate-600 ring-slate-200" },
  DISPUTED: { label: "Disputed", icon: AlertTriangle, pill: "bg-red-50 text-red-700 ring-red-200" },
};

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "delivered", label: "Delivered" },
  { id: "closed", label: "Closed" },
];

export function OrdersList({ slug, orders, accent, accentInk, storeName, orderWord }: { slug: string; orders: OrderCardData[]; accent: string; accentInk: string; storeName: string; orderWord: string }) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<OrderFilter, number> = { all: orders.length, active: 0, delivered: 0, closed: 0 };
    for (const o of orders) c[orderPhase(o.status)] += 1;
    return c;
  }, [orders]);

  const shown = useMemo(() => filterOrders(orders.map((o) => ({ ...o, items: o.items })), filter, query), [orders, filter, query]);
  const active = shown.filter((o) => orderPhase(o.status) === "active");
  const rest = shown.filter((o) => orderPhase(o.status) !== "active");
  // With "All" the in-progress orders are lifted into their own section; a single filter is one plain list.
  const sections = filter === "all" && active.length > 0 && rest.length > 0
    ? [{ title: "In progress", list: active }, { title: "Past orders", list: rest }]
    : [{ title: null as string | null, list: shown }];

  const ring = { ["--tw-ring-color" as string]: accent } as React.CSSProperties;

  return (
    <div>
      <div className="mb-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Search your {orderWord}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search by item or order number`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2"
            style={ring}
          />
        </label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter orders">
          {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id} type="button" aria-pressed={on} onClick={() => setFilter(f.id)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${on ? "" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                style={on ? { background: accent, color: readableOn(accent), ...ring } : ring}
              >
                {f.label} <span className={on ? "opacity-80" : "text-slate-400"}>{counts[f.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{shown.length} {shown.length === 1 ? "order" : "orders"} shown</p>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Nothing matches</p>
          <p className="mt-1 text-sm text-slate-500">Try a different word, or clear the filters.</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 rounded-full px-4 py-2 text-xs font-semibold" style={{ background: accent, color: readableOn(accent) }}>Clear filters</button>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title ?? "all"} aria-label={s.title ?? "Orders"}>
              {s.title && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{s.title} · {s.list.length}</h2>}
              <ul className="space-y-3">
                {s.list.map((o) => <li key={o.id}><OrderCard slug={slug} order={o} accent={accent} accentInk={accentInk} storeName={storeName} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ item, accent, fallback }: { item: OrderCardData["items"][number]; accent: string; fallback: string }) {
  return item.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-sm font-bold" style={{ background: accent, color: readableOn(accent) }}>{fallback}</span>
  );
}

function OrderCard({ slug, order, accent, accentInk, storeName }: { slug: string; order: OrderCardData; accent: string; accentInk: string; storeName: string }) {
  const st = STATUS[order.status] ?? STATUS.PAID;
  const Icon = st.icon;
  const names = order.items.map((i) => i.name);
  const phase = orderPhase(order.status);
  const step = progressIndex(order.status);
  const safeTrack = order.trackingUrl && /^https?:\/\//i.test(order.trackingUrl) ? order.trackingUrl : null;
  const reorder = order.items[0]?.href;
  const fallback = storeName.charAt(0).toUpperCase();
  const shownThumbs = order.items.slice(0, 3);
  const detailHref = `/store/${slug}/orders/${order.id}/confirmation`;
  const focusRing = { ["--tw-ring-color" as string]: accent } as React.CSSProperties;

  return (
    <article className={`relative rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${phase === "active" ? "border-slate-300" : "border-slate-200"}`}>
      <div className="flex gap-4 p-4">
        <div className="flex flex-shrink-0 -space-x-3" aria-hidden>
          {shownThumbs.map((it, i) => (
            <span key={i} className="relative h-14 w-14 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-white" style={{ zIndex: 3 - i }}><Thumb item={it} accent={accent} fallback={fallback} /></span>
          ))}
          {order.items.length > 3 && <span className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white ring-2 ring-white">+{order.items.length - 3}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${st.pill}`}><Icon className="h-3 w-3" aria-hidden />{st.label}</span>
            <span className="text-base font-extrabold tabular-nums text-slate-900">{order.totalLabel}</span>
          </div>
          <h3 className="mt-2 truncate text-[15px] font-semibold text-slate-900">
            <Link href={detailHref} className="rounded after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:ring-2" style={focusRing}>
              {itemsHeadline(names)}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500"><time title={order.placedTitle}>{order.placedLabel}</time> · #{order.shortId}{order.items.some((i) => i.qty > 1) ? ` · ${order.items.reduce((n, i) => n + i.qty, 0)} items` : ""}</p>
          <p className="mt-2 text-sm text-slate-600">
            {order.deliveryLabel && order.status === "IN_PROGRESS" ? `Delivery: ${order.deliveryLabel}` : statusBlurb(order.status)}
          </p>
        </div>
        <ArrowUpRight className="hidden h-4 w-4 flex-shrink-0 self-center text-slate-300 sm:block" aria-hidden />
      </div>

      {phase === "active" && step !== null && (
        <ol className="grid grid-cols-3 gap-2 px-4 pb-4" aria-label="Order progress">
          {PROGRESS_STEPS.map((label, i) => {
            const done = i < step, current = i === step;
            return (
              <li key={label} className="text-[11px]" aria-current={current ? "step" : undefined}>
                <span className="block h-1.5 rounded-full" style={{ background: done || current ? accent : "#e2e8f0", opacity: current ? 1 : done ? 0.55 : 1 }} />
                <span className={`mt-1.5 flex items-center gap-1 ${current ? "font-bold text-slate-900" : done ? "text-slate-600" : "text-slate-400"}`}>
                  {done && <Check className="h-3 w-3" aria-hidden />}{label}
                  {done && <span className="sr-only"> (done)</span>}{current && <span className="sr-only"> (current step)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-2.5 text-xs font-semibold">
        <Link href={detailHref} className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2" style={{ color: accentInk, ...focusRing }}>
          <ReceiptText className="h-3.5 w-3.5" aria-hidden />View order
        </Link>
        {safeTrack && (
          <a href={safeTrack} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2" style={{ color: accentInk, ...focusRing }}>
            <Truck className="h-3.5 w-3.5" aria-hidden />Track delivery{order.riderName ? ` · ${order.riderName}` : ""}
          </a>
        )}
        {reorder && phase !== "active" && order.status !== "DISPUTED" && (
          <Link href={reorder} className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2" style={{ color: accentInk, ...focusRing }}>
            <Repeat className="h-3.5 w-3.5" aria-hidden />Buy again
          </Link>
        )}
        {(order.hasDispute || order.canDispute) && (
          <Link href={`/disputes/${order.id}`} className="ml-auto inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-medium text-slate-500 hover:text-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2" style={focusRing}>
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />{order.hasDispute ? "View dispute" : "Report a problem"}
          </Link>
        )}
      </div>
    </article>
  );
}

/** The three summary tiles above the list. */
export function OrdersSummary({ spentLines, inProgress, delivered, accent }: { spentLines: string[]; inProgress: number; delivered: number; accent: string }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div
        className="col-span-2 flex items-center gap-3 rounded-2xl p-4 shadow-sm sm:col-span-1"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: readableOn(accent) }}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.22)" }}>
          <Wallet className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Total spent</p>
          {spentLines.map((line) => (
            <p key={line} className="truncate text-xl font-extrabold leading-tight tabular-nums">{line}</p>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${accent}1a`, color: accentInk(accent) }}>
          <Layers className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">In progress</p>
          <p className="text-xl font-extrabold leading-tight text-slate-900">{inProgress}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Delivered</p>
          <p className="text-xl font-extrabold leading-tight text-slate-900">{delivered}</p>
        </div>
      </div>
    </div>
  );
}
