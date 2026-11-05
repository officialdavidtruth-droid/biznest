/**
 * Pure helpers for the customer's "My orders" page. No database or React imports so they are easy to test.
 */

export type OrderPhase = "active" | "delivered" | "closed";

const ACTIVE = new Set(["PAID", "IN_PROGRESS"]);
const DELIVERED = new Set(["DELIVERED", "COMPLETED"]);

/** active = still being worked on, delivered = done and kept, closed = cancelled / refunded / disputed. */
export function orderPhase(status: string): OrderPhase {
  if (ACTIVE.has(status)) return "active";
  if (DELIVERED.has(status)) return "delivered";
  return "closed";
}

/** Money the customer has actually spent and kept: paid and fulfilled orders only. */
export function countsAsSpent(status: string): boolean {
  return ACTIVE.has(status) || DELIVERED.has(status);
}

export const PROGRESS_STEPS = ["Paid", "Preparing", "Delivered"] as const;

/** Index of the step an order has reached (0 to 2), or null for orders that are not on the happy path. */
export function progressIndex(status: string): number | null {
  if (status === "PAID") return 0;
  if (status === "IN_PROGRESS") return 1;
  if (DELIVERED.has(status)) return 2;
  return null;
}

/** One short, honest sentence on where the order stands. */
export function statusBlurb(status: string): string {
  switch (status) {
    case "PAID": return "Payment received. The store will start on it shortly.";
    case "IN_PROGRESS": return "The store is preparing your order.";
    case "DELIVERED": return "Delivered.";
    case "COMPLETED": return "Completed.";
    case "CANCELLED": return "This order was cancelled.";
    case "REFUNDED": return "Your money was returned.";
    case "DISPUTED": return "A dispute is open on this order.";
    default: return "";
  }
}

/** "Today", "Yesterday", "3 days ago", then the plain date. Calendar days in UTC+1 (Lagos) so an evening order is still "Today". */
export function relativeDay(date: Date, now: Date = new Date(), fullDate: string = ""): string {
  const LAGOS = 60 * 60_000;
  const day = (d: Date) => Math.floor((d.getTime() + LAGOS) / 86_400_000);
  const diff = day(now) - day(date);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return fullDate || date.toISOString().slice(0, 10);
}

export type Money = { currency: string; amount: number };

/** Total spent per currency (never mixing currencies under one label). Empty array when nothing was spent. */
export function spentByCurrency(orders: { status: string; currency: string; total: number }[]): Money[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!countsAsSpent(o.status)) continue;
    map.set(o.currency, (map.get(o.currency) ?? 0) + o.total);
  }
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}

export type OrderFilter = "all" | OrderPhase;

export type SearchableOrder = { id: string; status: string; items: { name: string }[] };

/** Filters by phase and by a search text matched against item names and the order number (any part of the id). */
export function filterOrders<T extends SearchableOrder>(orders: T[], filter: OrderFilter, query: string): T[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  return orders.filter((o) => {
    if (filter !== "all" && orderPhase(o.status) !== filter) return false;
    if (!q) return true;
    return o.id.toLowerCase().includes(q) || o.items.some((i) => i.name.toLowerCase().includes(q));
  });
}

/** "Lol", "Lol + 1 more", "Lol + 3 more". */
export function itemsHeadline(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "Order";
  if (clean.length === 1) return clean[0];
  return `${clean[0]} + ${clean.length - 1} more`;
}
