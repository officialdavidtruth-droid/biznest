import { toCsv } from "@/lib/utils/csv";
import { localDateStartUtc } from "@/lib/timezone";

export const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-10" -> [start, end) in UTC, aligned to the store's own timezone. */
export function monthBoundsUtc(month: string, tz: string): { start: Date; end: Date } | null {
  const m = MONTH_RE.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: localDateStartUtc(`${y}-${pad(mo)}-01`, tz), end: localDateStartUtc(`${ny}-${pad(nm)}-01`, tz) };
}

/** The calendar month before `now` as "YYYY-MM" (UTC; the cron runs on the 1st). */
export function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type LedgerOrder = {
  createdAt: Date;
  orderId: string;
  status: string;
  channel: string;
  customer: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  provider: string | null;
  paymentReference: string | null;
  refundedAmount: number;
  payoutAmount: number | null;
  gatewayFee: number | null;
  payoutStatus: string | null;
  payoutPaidAt: Date | null;
};

/**
 * Spreadsheet apps run text that starts with = + - @ as a formula. Customer
 * names are attacker-controlled, so neutralise those before they reach an
 * accountant's Excel.
 */
export function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");
const num = (n: number | null) => (n == null ? "" : n.toFixed(2));

export const LEDGER_HEADERS = [
  "Date (UTC)", "Order ID", "Status", "Channel", "Customer", "Subtotal", "Delivery fee", "Order total", "Currency",
  "Payment provider", "Payment reference", "Refunded", "Payout amount", "Gateway fee", "Payout status", "Payout date (UTC)",
];

export function ledgerCsv(rows: LedgerOrder[]): string {
  const body = rows.map((r) => [
    iso(r.createdAt), r.orderId, r.status, r.channel, safeCell(r.customer), num(r.subtotal), num(r.deliveryFee), num(r.total), r.currency,
    r.provider ?? "", r.paymentReference ?? "", num(r.refundedAmount || null), num(r.payoutAmount), num(r.gatewayFee), r.payoutStatus ?? "", iso(r.payoutPaidAt),
  ]);
  // BOM so Excel opens the UTF-8 file with names intact.
  return "\uFEFF" + toCsv(LEDGER_HEADERS, body);
}
