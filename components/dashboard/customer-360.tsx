"use client";

import { useMemo, useState } from "react";
import { Mail, MessageCircle, Phone, Search, ShoppingBag, UserRound } from "lucide-react";
import type { Customer360 } from "@/lib/actions/customers";

// Set when arriving here from a link elsewhere in the dashboard (e.g.
// clicking a customer's name on the Bookings page) that wants a specific
// person opened rather than whoever happens to be first in the list.
type OpenHint = { userId?: string; email?: string; phone?: string; name?: string };

function phoneDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

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
    const target = phoneDigits(phone);
    const match = customers.find((c) => phoneDigits(c.phone) === target);
    if (match) return match;
  }
  if (name) {
    const match = customers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function money(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "CU";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function Customer360View({ customers, openHint }: { customers: Customer360[]; openHint?: OpenHint }) {
  const hinted = useMemo(() => resolveHint(customers, openHint), [customers, openHint]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(hinted?.id ?? customers[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => [c.name, c.email, c.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [customers, query]);

  const selected = customers.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-semibold">Customer 360</h1><p className="text-sm text-muted-foreground">Online, POS and repeat-customer activity in one profile.</p></div>
        <div className="text-xs text-muted-foreground">{customers.length} customer{customers.length === 1 ? "" : "s"}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or email" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto p-2">
            {filtered.map((customer) => (
              <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`mb-1 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${selected?.id === customer.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(customer.name)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{customer.name}</p><p className="truncate text-xs text-muted-foreground">{customer.phone || customer.email || "No contact"}</p></div>
                <div className="text-right"><p className="text-xs font-semibold">{money(customer.spent)}</p><p className="text-[10px] text-muted-foreground">{customer.orders} order{customer.orders === 1 ? "" : "s"}</p></div>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-10 text-center text-xs text-muted-foreground">No customers match that search.</p>}
          </div>
        </section>

        {selected ? <section className="space-y-4">
          <div className="rounded-xl border bg-background p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{initials(selected.name)}</div><div><h2 className="text-lg font-semibold">{selected.name}</h2><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{selected.email || "No email"}</span><span>{selected.phone || "No phone"}</span></div></div></div>
              <div className="flex gap-2">
                {selected.phone && <a className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted" href={`tel:${selected.phone}`}><Phone className="h-3.5 w-3.5" /> Call</a>}
                {selected.phone && <a className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" target="_blank" rel="noreferrer" href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
                {selected.email && <a className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted" href={`mailto:${selected.email}`}><Mail className="h-3.5 w-3.5" /> Email</a>}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[['Lifetime value', money(selected.spent)], ['Orders', String(selected.orders)], ['Average order', money(selected.averageOrder)], ['Last purchase', formatDate(selected.lastPurchase)]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>)}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">Online sales</p><p className="mt-1 text-xl font-semibold">{selected.onlineOrders}</p></div>
            <div className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">POS sales</p><p className="mt-1 text-xl font-semibold">{selected.posOrders}</p></div>
            <div className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">Customer since</p><p className="mt-1 text-sm font-semibold">{formatDate(selected.firstPurchase)}</p></div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Recent orders</h3></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-2 py-2">Order</th><th className="px-2 py-2">Channel</th><th className="px-2 py-2">Items</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Date</th></tr></thead><tbody>{selected.ordersList.map((o) => <tr key={o.id} className="border-b last:border-0"><td className="px-2 py-3 font-medium">{o.number}</td><td className="px-2 py-3"><span className="rounded-full bg-muted px-2 py-1 text-[10px]">{o.channel}</span></td><td className="max-w-[260px] px-2 py-3 text-xs text-muted-foreground">{o.items.join(", ") || "—"}</td><td className="px-2 py-3 text-right font-medium">{money(o.total)}</td><td className="px-2 py-3 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td></tr>)}{selected.ordersList.length === 0 && <tr><td colSpan={5} className="px-2 py-10 text-center text-xs text-muted-foreground">No completed purchases yet.</td></tr>}</tbody></table></div>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-semibold">Top products</h3><p className="mb-3 mt-1 text-xs text-muted-foreground">Based on purchase history</p>
              <div className="space-y-3">{selected.topProducts.map((p) => <div key={p.name} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium">{p.name}</p><p className="text-[11px] text-muted-foreground">{p.quantity} item{p.quantity === 1 ? "" : "s"}</p></div><p className="text-xs font-semibold">{money(p.revenue)}</p></div>)}{selected.topProducts.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No product history yet.</p>}</div>
            </div>
          </div>

          {selected.notes && <div className="rounded-xl border bg-primary/5 p-4 text-sm"><p className="font-medium">Customer notes</p><p className="mt-1 text-sm text-muted-foreground">{selected.notes}</p></div>}
        </section> : <section className="grid min-h-[420px] place-items-center rounded-xl border bg-background"><div className="text-center"><UserRound className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">Select a customer</p><p className="mt-1 text-xs text-muted-foreground">Their complete sales history will appear here.</p></div></section>}
      </div>
    </div>
  );
}
