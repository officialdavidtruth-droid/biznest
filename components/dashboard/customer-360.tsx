"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { phoneKey } from "@/lib/phone";
import { ArrowLeft, ChevronRight, Mail, MessageCircle, Phone, Search, ShoppingBag, UserRound, Users, Wallet, Repeat } from "lucide-react";
import type { Customer360 } from "@/lib/actions/customers";
import { saveCustomerNotes } from "@/lib/actions/customers";
import { ListPagination } from "@/components/dashboard/list-toolbar";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate as formatLocaleDate } from "@/lib/i18n/locale";
import { summarizeCustomers } from "@/lib/customer-360-stats";
import { TableScroll } from "@/components/ui/table-scroll";

// Set when arriving here from a link elsewhere in the dashboard (e.g.
// clicking a customer's name on the Bookings page) that wants a specific
// person opened rather than whoever happens to be first in the list.
type OpenHint = { userId?: string; email?: string; phone?: string; name?: string };

// Finds the customer a link was pointing at: match on account first
// (most reliable), then email, then phone, then exact name as a last
// resort for guest bookings with no other contact info on file.
function resolveHint(customers: Customer360[], hint?: OpenHint) {
  if (!hint) return undefined;
  const { userId, email, phone, name } = hint;
  if (userId) {
    const match = customers.find((c) => c.userId === userId);
    if (match) return match;
  }
  if (email) {
    const target = email.trim().toLowerCase();
    const match = customers.find((c) => c.email?.toLowerCase() === target);
    if (match) return match;
  }
  if (phone) {
    const target = phoneKey(phone);
    const match = target ? customers.find((c) => phoneKey(c.phone) === target) : undefined;
    if (match) return match;
  }
  if (name) {
    const match = customers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "CU";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return formatLocaleDate(value);
}

function NotesEditor({ slug, profileId, initial, label }: { slug: string; profileId: string; initial: string | null; label: string }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveCustomerNotes(slug, profileId, value);
    if (r.success) { setSaved(value.trim()); setMsg("Saved"); } else setMsg(r.error);
  });
  return (
    <div className="rounded-2xl border bg-primary/5 p-4 text-sm">
      <p className="font-semibold">{label} notes</p>
      <p className="text-[11px] text-muted-foreground">Private to your team. The customer never sees these.</p>
      <textarea value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} maxLength={2000} rows={3} placeholder="Preferences, sizes, allergies, follow-ups…" className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-base sm:text-sm" />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending || value.trim() === saved} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Saving…" : "Save notes"}</button>
        {msg && <span role="status" className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

type SortKey = "spent" | "recent" | "repeat";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "spent", label: "Top spenders" },
  { key: "recent", label: "Recent" },
  { key: "repeat", label: "Repeat" },
];

function SummaryTile({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string | number; note: string }) {
  return (
    <div className="min-w-0 p-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4 shrink-0 text-primary" /><p className="truncate text-xs font-medium">{label}</p></div>
      <p className="mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

export function Customer360View({
  slug,
  customers,
  openHint,
  sellsProducts = true,
  offersServices = false,
  walkIn,
  currency = "NGN",
  locale = null,
  mixedCurrencies = null,
}: {
  slug: string;
  customers: Customer360[];
  openHint?: OpenHint;
  // Set once at onboarding (see lib/actions/customers.ts). A pure-service
  // business (offersServices only) gets "Client 360" with no POS/online
  // channel breakdown, since it has no POS. A pure-product business keeps
  // "Customer 360". Hybrids (both true) keep the full customer-style view
  // since they do run POS sales alongside services.
  sellsProducts?: boolean;
  offersServices?: boolean;
  // Anonymous POS sales, shown as a note rather than as a customer.
  walkIn?: { orders: number; spent: number };
  // Store currency/locale, so a non-NGN store is not shown in naira.
  currency?: string;
  locale?: string | null;
  // Set when counted records use more than one currency; totals are not converted.
  mixedCurrencies?: string[] | null;
}) {
  const money = (value: number, cur?: string | null) => formatMoney(value, cur || currency, { locale });
  const isServiceOnly = offersServices && !sellsProducts;
  const personLabel = isServiceOnly ? "Client" : "Customer";
  const peopleLabel = isServiceOnly ? "Clients" : "Customers";
  const hinted = useMemo(() => resolveHint(customers, openHint), [customers, openHint]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spent");
  const [selectedId, setSelectedId] = useState(hinted?.id ?? customers[0]?.id ?? null);
  // Phones show either the list or one profile at a time (with a Back button);
  // from lg up both sit side by side.
  const [mobileDetail, setMobileDetail] = useState(Boolean(hinted));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const detailRef = useRef<HTMLElement | null>(null);
  const pick = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
    if (typeof window !== "undefined") requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? customers.filter((c) => [c.name, c.email, c.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(q))) : customers;
    const time = (v: string | null) => (v ? new Date(v).getTime() || 0 : 0);
    const list = sort === "repeat" ? base.filter((c) => c.orders >= 2) : [...base];
    if (sort === "recent") list.sort((a, b) => time(b.lastPurchase) - time(a.lastPurchase));
    else list.sort((a, b) => b.spent - a.spent);
    return list;
  }, [customers, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selected = customers.find((c) => c.id === selectedId) ?? paged[0] ?? filtered[0] ?? null;

  const { lifetimeValue: totalLifetimeValue, repeatCount, averageOrder: avgOrderValue } = useMemo(() => summarizeCustomers(customers), [customers]);

  const topMax = selected ? Math.max(1, ...selected.topProducts.map((p) => p.revenue)) : 1;
  const channelPills = selected
    ? [
        sellsProducts ? { label: "Online", value: selected.onlineOrders } : null,
        sellsProducts ? { label: "POS", value: selected.posOrders } : null,
        offersServices ? { label: "Paid bookings", value: selected.bookingCount } : null,
      ].filter((x): x is { label: string; value: number } => x !== null)
    : [];

  return (
    <div className="bn-admin-page space-y-4 sm:space-y-5">
      <div className={mobileDetail ? "hidden lg:block" : ""}>
        <h1 className="text-2xl font-bold">{personLabel} 360</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isServiceOnly ? "Every client's booking and purchase history in one profile." : "Online, POS and repeat-customer activity in one profile."}
        </p>
      </div>

      <div className={`${mobileDetail ? "hidden lg:grid" : "grid"} grid-cols-2 divide-x divide-y overflow-hidden rounded-2xl border bg-background shadow-sm lg:grid-cols-4 lg:divide-y-0`}>
        <SummaryTile icon={Users} label={`Total ${peopleLabel}`} value={customers.length} note="All time" />
        <SummaryTile icon={Wallet} label="Lifetime value" value={money(totalLifetimeValue)} note="Combined spend" />
        <SummaryTile icon={ShoppingBag} label={isServiceOnly ? "Average booking" : "Average order"} value={money(avgOrderValue)} note="Per order" />
        <SummaryTile icon={Repeat} label="Repeat" value={repeatCount} note={`With 2+ ${isServiceOnly ? "bookings" : "orders"}`} />
      </div>

      {walkIn && walkIn.orders > 0 && (
        <p className={`${mobileDetail ? "hidden lg:block" : ""} rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground`}>
          Walk-in sales with no {personLabel.toLowerCase()} recorded: {walkIn.orders} order{walkIn.orders === 1 ? "" : "s"} · {money(walkIn.spent)}. These are not counted in the figures above.
        </p>
      )}

      {mixedCurrencies && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Some records use different currencies ({mixedCurrencies.join(", ")}). Amounts are added together without conversion, so totals here may be misleading.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <section className={`${mobileDetail ? "hidden lg:block" : ""} overflow-hidden rounded-2xl border bg-background shadow-sm`}>
          <div className="space-y-3 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name, phone or email" className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Sort customers">
              {SORTS.map((s) => (
                <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} onClick={() => { setSort(s.key); setPage(1); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${sort === s.key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/40"}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <ul className="divide-y">
            {paged.map((customer) => {
              const active = selected?.id === customer.id;
              return (
                <li key={customer.id}>
                  <button type="button" onClick={() => pick(customer.id)} aria-current={active ? "true" : undefined} className={`flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors lg:py-3 ${active ? "bg-[hsl(var(--primary)/0.1)] lg:shadow-[inset_3px_0_0_hsl(var(--primary))]" : "hover:bg-muted/60"}`}>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary lg:h-10 lg:w-10">{initials(customer.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{customer.name}</span>{customer.orders >= 2 && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Repeat</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{customer.phone || customer.email || "No contact"}</p>
                    </div>
                    <div className="shrink-0 text-right"><p className="text-sm font-semibold">{money(customer.spent)}</p><p className="text-[11px] text-muted-foreground">{customer.orders} order{customer.orders === 1 ? "" : "s"}</p></div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 lg:hidden" aria-hidden />
                  </button>
                </li>
              );
            })}
            {paged.length === 0 && <li className="px-3 py-12 text-center text-xs text-muted-foreground">{sort === "repeat" && !query ? `No repeat ${peopleLabel.toLowerCase()} yet.` : `No ${peopleLabel.toLowerCase()} match that search.`}</li>}
          </ul>
          <ListPagination
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </section>

        {selected ? <section ref={detailRef} className={`${mobileDetail ? "" : "hidden lg:block"} scroll-mt-20 space-y-4`}>
          <button type="button" onClick={() => setMobileDetail(false)} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-semibold shadow-sm lg:hidden"><ArrowLeft className="h-3.5 w-3.5" />All {peopleLabel.toLowerCase()}</button>

          <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground sm:h-16 sm:w-16">{initials(selected.name)}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold sm:text-xl">{selected.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">{personLabel} since {formatDate(selected.firstPurchase)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{[selected.phone, selected.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                </div>
              </div>
              {(selected.phone || selected.email) && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                  {selected.phone ? <a className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2.5 text-xs font-semibold hover:bg-muted" href={`tel:${selected.phone}`}><Phone className="h-4 w-4" />Call</a> : <span />}
                  {selected.phone && whatsappLink(selected.phone) ? <a className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90" target="_blank" rel="noreferrer" href={whatsappLink(selected.phone)!}><MessageCircle className="h-4 w-4" />WhatsApp</a> : <span />}
                  {selected.email ? <a className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2.5 text-xs font-semibold hover:bg-muted" href={`mailto:${selected.email}`}><Mail className="h-4 w-4" />Email</a> : <span />}
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
              {[["Lifetime value", money(selected.spent)], [isServiceOnly ? "Bookings" : "Orders", String(selected.orders)], [isServiceOnly ? "Average booking" : "Average order", money(selected.averageOrder)], ["Last purchase", formatDate(selected.lastPurchase)]].map(([label, value]) => (
                <div key={label} className="min-w-0 p-4"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-base font-semibold">{value}</dd></div>
              ))}
            </dl>
            {channelPills.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t px-4 py-3">
                {channelPills.map((c) => <span key={c.label} className="rounded-full bg-muted px-3 py-1 text-xs"><span className="text-muted-foreground">{c.label}</span> <span className="font-semibold">{c.value}</span></span>)}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
            <div className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{isServiceOnly ? "Recent bookings" : "Recent orders"}</h3></div>
              {selected.ordersList.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">{isServiceOnly ? "No completed bookings yet." : "No completed purchases yet."}</p>
              ) : (
                <ul className="divide-y">
                  {selected.ordersList.map((o) => (
                    <li key={o.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">{o.number}{sellsProducts && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{o.channel}</span>}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{o.items.join(", ") || "—"}</p>
                      </div>
                      <div className="shrink-0 text-right"><p className="text-sm font-semibold">{money(o.total, o.currency)}</p><p className="text-[11px] text-muted-foreground">{formatDate(o.createdAt)}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border bg-background p-4 shadow-sm">
              <h3 className="text-sm font-semibold">{isServiceOnly ? "Top services" : "Top products"}</h3><p className="mb-3 mt-0.5 text-xs text-muted-foreground">Based on purchase history</p>
              <div className="space-y-3.5">
                {selected.topProducts.map((p) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-medium">{p.name}</p><p className="shrink-0 text-xs font-semibold">{money(p.revenue)}</p></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, Math.round((p.revenue / topMax) * 100))}%` }} /></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{p.quantity} item{p.quantity === 1 ? "" : "s"}</p>
                  </div>
                ))}
                {selected.topProducts.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No {isServiceOnly ? "service" : "product"} history yet.</p>}
              </div>
            </div>
          </div>

          {(selected.bills?.length > 0 || selected.roomChargesPaid > 0 || selected.roomChargesOpen > 0) && <div className="rounded-2xl border bg-background p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Hotel bills & room charges</h3><p className="mt-1 text-xs text-muted-foreground">Charges posted to this guest's room folio from PMS. Voided charges are hidden and room charges are not counted in lifetime value above.</p></div><Wallet className="h-4 w-4 shrink-0 text-muted-foreground" /></div><div className="mb-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">Room charges paid</p><p className="mt-1 text-base font-semibold">{money(selected.roomChargesPaid)}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">Open balance</p><p className="mt-1 text-base font-semibold">{money(selected.roomChargesOpen)}</p></div></div><TableScroll><table className="w-full text-sm"><thead className="border-b text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-2 py-2">Charge</th><th className="px-2 py-2">Room</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Date</th></tr></thead><tbody>{selected.bills.map((b) => <tr key={b.id} className="border-b last:border-0"><td className="px-2 py-3"><p className="font-medium">{b.description}</p><p className="text-[11px] text-muted-foreground">{b.category || "General"}</p></td><td className="px-2 py-3 text-xs text-muted-foreground">{b.room || "—"}</td><td className="px-2 py-3"><span className="rounded-full bg-muted px-2 py-1 text-[10px]">{b.status}</span></td><td className="px-2 py-3 text-right font-medium">{money(b.amount, b.currency)}</td><td className="px-2 py-3 text-xs text-muted-foreground">{formatDate(b.postedAt)}</td></tr>)}</tbody></table></TableScroll></div>}

          {selected.profileId ? <NotesEditor key={selected.profileId} slug={slug} profileId={selected.profileId} initial={selected.notes} label={personLabel} />
            : selected.notes && <div className="rounded-2xl border bg-primary/5 p-4 text-sm"><p className="font-semibold">{personLabel} notes</p><p className="mt-1 text-sm text-muted-foreground">{selected.notes}</p></div>}
        </section> : <section className="grid min-h-[320px] place-items-center rounded-2xl border bg-background"><div className="text-center"><UserRound className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Select a {personLabel.toLowerCase()}</p><p className="mt-1 text-xs text-muted-foreground">Their complete {isServiceOnly ? "booking" : "sales"} history will appear here.</p></div></section>}
      </div>
    </div>
  );
}
