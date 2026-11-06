/**
 * Pure helpers for event ticketing: tiers, order validation, ticket codes and gate scanning.
 * No database or Next.js imports so they are easy to test.
 */
import { money, newPortalToken, lastReceiptSeq, receiptNumber } from "@/lib/real-estate";

export { money, lastReceiptSeq, receiptNumber };

/** Gateway references for a ticket purchase: TKT-<orderId>-<token>. */
export const TICKET_PAY_PREFIX = "TKT";
export const TICKET_MIN_ONLINE_PAYMENT = 100;
/** Unpaid orders hold their seats this long. */
export const TICKET_HOLD_MINUTES = 30;
export const MAX_TICKETS_PER_ORDER = 20;
export const TICKET_PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "POS", "COMP", "OTHER"] as const;
export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"] as const;

export const newAccessToken = newPortalToken;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I so a code read aloud or typed at the gate is hard to get wrong
/** A 16-character ticket code (80 bits) from the platform CSPRNG. This is what the QR code carries. */
export function newTicketCode(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Normalises what a scanner or a person typed: upper case, spaces and dashes removed. */
export function normaliseCode(raw: string): string {
  const v = raw.trim();
  const m = v.match(/[?&]c=([A-Za-z0-9]+)/); // a QR may carry a full URL
  return (m ? m[1] : v).toUpperCase().replace(/[\s-]/g, "");
}
export const isTicketCode = (v: string) => /^[A-HJ-NP-Z2-9]{16}$/.test(v);

export function slugifyTitle(title: string): string {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base.slice(0, 60) || "event";
}

export type TierLike = { id: string; name: string; price: number | string; capacity: number; sold: number; maxPerOrder: number; saleEndsAt?: Date | string | null; active: boolean };

export function tierAvailable(t: Pick<TierLike, "capacity" | "sold">): number {
  return Math.max(0, t.capacity - t.sold);
}

export type TierState = "ON_SALE" | "SOLD_OUT" | "SALE_ENDED" | "OFF";
export function tierState(t: TierLike, now: Date = new Date()): TierState {
  if (!t.active) return "OFF";
  if (t.saleEndsAt && new Date(t.saleEndsAt).getTime() < now.getTime()) return "SALE_ENDED";
  if (tierAvailable(t) <= 0) return "SOLD_OUT";
  return "ON_SALE";
}

export type EventLike = { status: string; startsAt: Date | string; endsAt?: Date | string | null };
/** Sales close when the event is closed/cancelled or has ended (or, with no end time, a day after it started). */
export function eventOpenForSale(e: EventLike, now: Date = new Date()): boolean {
  if (e.status !== "PUBLISHED") return false;
  const end = e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 24 * 3_600_000;
  return end > now.getTime();
}

export type OrderRequest = { tierId: string; qty: number }[];

/**
 * Checks a purchase against current tier data and prices it from the tiers (never from the client).
 * Duplicate tier lines are merged. Capacity here is advisory: the real hold is the atomic update in the action.
 */
export function priceOrder(tiers: TierLike[], request: OrderRequest, now: Date = new Date()):
  { ok: true; lines: { tierId: string; name: string; qty: number; unitPrice: number }[]; total: number; count: number } | { ok: false; error: string } {
  const merged = new Map<string, number>();
  for (const r of request) {
    const qty = Math.floor(Number(r.qty));
    if (!r.tierId || !Number.isFinite(qty) || qty < 0) return { ok: false, error: "Choose a valid number of tickets." };
    if (qty > 0) merged.set(r.tierId, (merged.get(r.tierId) ?? 0) + qty);
  }
  if (merged.size === 0) return { ok: false, error: "Choose at least one ticket." };
  const lines: { tierId: string; name: string; qty: number; unitPrice: number }[] = [];
  let total = 0, count = 0;
  for (const [tierId, qty] of merged) {
    const t = tiers.find((x) => x.id === tierId);
    if (!t) return { ok: false, error: "That ticket type isn't available." };
    const st = tierState(t, now);
    if (st === "SOLD_OUT") return { ok: false, error: `${t.name} is sold out.` };
    if (st === "SALE_ENDED") return { ok: false, error: `Sales for ${t.name} have ended.` };
    if (st === "OFF") return { ok: false, error: "That ticket type isn't available." };
    if (qty > t.maxPerOrder) return { ok: false, error: `You can buy at most ${t.maxPerOrder} ${t.name} tickets at once.` };
    if (qty > tierAvailable(t)) return { ok: false, error: `Only ${tierAvailable(t)} ${t.name} ticket${tierAvailable(t) === 1 ? "" : "s"} left.` };
    const unitPrice = money(t.price);
    lines.push({ tierId, name: t.name, qty, unitPrice });
    total += unitPrice * qty; count += qty;
  }
  if (count > MAX_TICKETS_PER_ORDER) return { ok: false, error: `You can buy at most ${MAX_TICKETS_PER_ORDER} tickets in one order.` };
  return { ok: true, lines, total: Math.round(total * 100) / 100, count };
}

export type ScanTicket = { status: string; checkedInAt?: Date | string | null; holderName?: string | null; tierName?: string; eventId: string };
export type ScanResult =
  | { ok: true; message: string }
  | { ok: false; reason: "NOT_FOUND" | "WRONG_EVENT" | "ALREADY_IN" | "VOID" | "EVENT_CANCELLED"; message: string };

/** The gate's verdict on a scanned ticket. `at` is shown so staff can see when a duplicate first got in. */
export function scanVerdict(ticket: ScanTicket | null, event: { id: string; status: string }): ScanResult {
  if (!ticket) return { ok: false, reason: "NOT_FOUND", message: "Ticket not found." };
  if (ticket.eventId !== event.id) return { ok: false, reason: "WRONG_EVENT", message: "This ticket is for a different event." };
  if (event.status === "CANCELLED") return { ok: false, reason: "EVENT_CANCELLED", message: "This event was cancelled." };
  if (ticket.status === "VOID") return { ok: false, reason: "VOID", message: "This ticket was cancelled." };
  if (ticket.status === "CHECKED_IN") {
    const at = ticket.checkedInAt ? new Date(ticket.checkedInAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "earlier";
    return { ok: false, reason: "ALREADY_IN", message: `Already used at ${at}.` };
  }
  return { ok: true, message: `Welcome${ticket.holderName ? `, ${ticket.holderName}` : ""}${ticket.tierName ? ` (${ticket.tierName})` : ""}.` };
}

export type CleanEvent = { title: string; description: string | null; venue: string | null; startsAt: Date; endsAt: Date | null };

export function sanitizeEvent(input: { title?: unknown; description?: unknown; venue?: unknown; startsAt?: unknown; endsAt?: unknown }): { ok: true; event: CleanEvent } | { ok: false; error: string } {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!title) return { ok: false, error: "Give the event a name." };
  const startsAt = new Date(String(input.startsAt ?? ""));
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Choose when the event starts." };
  let endsAt: Date | null = null;
  if (input.endsAt) {
    endsAt = new Date(String(input.endsAt));
    if (Number.isNaN(endsAt.getTime())) return { ok: false, error: "That end time doesn't look right." };
    if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "The event must end after it starts." };
  }
  return { ok: true, event: { title, description: String(input.description ?? "").trim().slice(0, 2000) || null, venue: String(input.venue ?? "").trim().slice(0, 160) || null, startsAt, endsAt } };
}

export function sanitizeTier(input: { name?: unknown; price?: unknown; capacity?: unknown; maxPerOrder?: unknown; saleEndsAt?: unknown }):
  { ok: true; tier: { name: string; price: number; capacity: number; maxPerOrder: number; saleEndsAt: Date | null } } | { ok: false; error: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return { ok: false, error: "Give the ticket type a name." };
  const price = money(input.price ?? 0);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Enter a valid price (0 for free)." };
  if (price > 0 && price < TICKET_MIN_ONLINE_PAYMENT) return { ok: false, error: `Paid tickets start at ${TICKET_MIN_ONLINE_PAYMENT}.` };
  const capacity = Math.floor(Number(input.capacity));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 100_000) return { ok: false, error: "Enter how many tickets are available." };
  const maxPerOrder = input.maxPerOrder ? Math.floor(Number(input.maxPerOrder)) : 10;
  if (!Number.isFinite(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > MAX_TICKETS_PER_ORDER) return { ok: false, error: `Per-order limit must be 1 to ${MAX_TICKETS_PER_ORDER}.` };
  let saleEndsAt: Date | null = null;
  if (input.saleEndsAt) { saleEndsAt = new Date(String(input.saleEndsAt)); if (Number.isNaN(saleEndsAt.getTime())) return { ok: false, error: "That sale end time doesn't look right." }; }
  return { ok: true, tier: { name, price, capacity, maxPerOrder, saleEndsAt } };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function sanitizeBuyer(input: { name?: unknown; email?: unknown; phone?: unknown }, needEmail = true): { ok: true; buyer: { name: string; email: string | null; phone: string | null } } | { ok: false; error: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Enter your name." };
  const email = String(input.email ?? "").trim().toLowerCase();
  if (needEmail && !email) return { ok: false, error: "Enter your email so we can send your tickets." };
  if (email && (email.length > 160 || !EMAIL_RE.test(email))) return { ok: false, error: "That email address doesn't look right." };
  const phoneRaw = String(input.phone ?? "").trim();
  const digits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && (digits.length < 7 || digits.length > 15)) return { ok: false, error: "That phone number doesn't look right." };
  return { ok: true, buyer: { name, email: email || null, phone: phoneRaw ? phoneRaw.replace(/[^\d+]/g, "").slice(0, 20) : null } };
}

export const ticketsPagePath = (slug: string, token: string) => `/store/${slug}/ticket/${token}`;
export const eventPagePath = (slug: string, eventSlug: string) => `/store/${slug}/tickets/${eventSlug}`;
