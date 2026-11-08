import { showBizNestBranding } from "@/lib/branding";
import "server-only";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import type { StaffPermissionId } from "@/lib/access/staff-permissions";
import { formatDate } from "@/lib/i18n/locale";
import { moneyFormatter } from "@/lib/utils/format-money";

/**
 * Vendor-side printable receipts. Three kinds, all read-only views over data that already
 * exists (no schema change):
 *   order   - what was sold in an Order (online or POS)
 *   payment - proof that a specific Payment was received (order, invoice, booking, deposit)
 *   bill    - an Invoice, printed as a bill/receipt for the customer
 *
 * Everything is pre-formatted to strings here so the print view is purely presentational and
 * renders identically on the server and the client.
 */

export type ReceiptKind = "order" | "payment" | "bill" | "folio";

export const RECEIPT_KINDS: ReceiptKind[] = ["order", "payment", "bill", "folio"];

export function isReceiptKind(value: string): value is ReceiptKind {
  return (RECEIPT_KINDS as string[]).includes(value);
}

export type ReceiptTone = "paid" | "pending" | "void";

export type ReceiptData = {
  kind: ReceiptKind;
  heading: string;
  number: string;
  issuedAt: string;
  store: { name: string; slug: string; logoUrl: string | null; email: string | null; phone: string | null; poweredBy: boolean };
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null };
  lines: Array<{ description: string; qty: number; unit: string; amount: string }>;
  totals: Array<{ label: string; value: string; strong?: boolean }>;
  status: { label: string; tone: ReceiptTone };
  details: Array<{ label: string; value: string }>;
  note: string | null;
};

type LoadResult = { ok: true; receipt: ReceiptData } | { ok: false; error: string; status: 401 | 403 | 404 };

const PERMISSIONS: Record<ReceiptKind, StaffPermissionId[]> = {
  order: ["orders", "pos", "payments"],
  payment: ["payments", "orders", "pos"],
  bill: ["orders", "finance", "payments"],
  folio: ["orders", "pos", "finance", "payments"],
};

const PROVIDER_LABEL: Record<string, string> = {
  PAYSTACK: "Paystack (card/online)",
  FLUTTERWAVE: "Flutterwave (card/online)",
  KORAPAY: "Korapay (card/online)",
  CASH: "Cash / bank transfer",
  WALLET: "Store wallet",
};

const ORDER_PAID = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

type StoreLike = {
  id: string;
  slug: string;
  subscriptionRenewsAt?: Date | null;
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  locale: string | null;
  timezone: string;
};

function storeBlock(store: StoreLike): ReceiptData["store"] {
  return { name: store.name, slug: store.slug, logoUrl: store.logoUrl, email: store.contactEmail, phone: store.contactPhone, poweredBy: showBizNestBranding(store) };
}

function addressText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const parts = [a.address, a.city, a.state, a.country].filter((p): p is string => typeof p === "string" && p.trim() !== "");
  return parts.length ? parts.join(", ") : null;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function loadReceipt(slug: string, kind: ReceiptKind, id: string): Promise<LoadResult> {
  const access = await assertAnyStorePermission(slug, PERMISSIONS[kind]);
  if (!access.success) {
    const signedOut = access.error === "You must be signed in.";
    return { ok: false, error: access.error, status: signedOut ? 401 : access.error === "Store not found." ? 404 : 403 };
  }
  const store = access.store as unknown as StoreLike;
  const money = moneyFormatter(store, { decimals: 2 });
  const when = (d: Date | null | undefined) =>
    formatDate(d, { locale: store.locale, timeZone: store.timezone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  if (kind === "order") return loadOrder(store, id, money, when);
  if (kind === "payment") return loadPayment(store, id, money, when);
  if (kind === "folio") return loadFolio(store, id, money, when);
  return loadBill(store, id, money, when);
}

type Money = ReturnType<typeof moneyFormatter>;
type When = (d: Date | null | undefined) => string;

async function loadOrder(store: StoreLike, id: string, money: Money, when: When): Promise<LoadResult> {
  const order = await prisma.order.findFirst({
    where: { id, storeId: store.id },
    include: {
      buyer: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } }, service: { select: { name: true } } } },
    },
  });
  if (!order) return { ok: false, error: "Order not found.", status: 404 };

  const isPos = order.channel === "POS";
  const address = order.shippingAddress as { fullName?: string; phone?: string } | null;
  const subtotal = Number(order.subtotal);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const total = Number(order.total);
  const paid = ORDER_PAID.includes(order.status);
  const void_ = order.status === "CANCELLED";
  const method = order.posTenderType ?? (order.paymentProvider ? PROVIDER_LABEL[order.paymentProvider] ?? order.paymentProvider : null);

  const totals: ReceiptData["totals"] = [{ label: "Subtotal", value: money(subtotal) }];
  if (deliveryFee > 0) totals.push({ label: "Delivery fee", value: money(deliveryFee) });
  const discountish = subtotal + deliveryFee - total;
  if (discountish > 0.009) totals.push({ label: "Discount", value: `-${money(discountish)}` });
  totals.push({ label: paid ? "Total paid" : "Total", value: money(total), strong: true });

  const details: ReceiptData["details"] = [];
  if (method) details.push({ label: "Payment method", value: method });
  if (order.paymentReference) details.push({ label: "Payment reference", value: order.paymentReference });
  if (isPos) details.push({ label: "Sold at", value: "In store (POS)" });
  if (order.fnbTableLabel) details.push({ label: "Table", value: order.fnbTableLabel });

  return {
    ok: true,
    receipt: {
      kind: "order",
      heading: "Order receipt",
      number: `#${order.id.slice(-8).toUpperCase()}`,
      issuedAt: when(order.createdAt),
      store: storeBlock(store),
      customer: isPos
        ? { name: order.posCustomerName ?? "Walk-in customer", email: null, phone: order.posCustomerPhone ?? null, address: null }
        : { name: address?.fullName ?? order.buyer.name, email: order.buyer.email, phone: address?.phone ?? null, address: addressText(order.shippingAddress) },
      lines: order.items.map((item) => ({
        description: item.product?.name ?? item.service?.name ?? "Item",
        qty: item.quantity,
        unit: money(Number(item.unitPrice)),
        amount: money(Number(item.unitPrice) * item.quantity),
      })),
      totals,
      status: void_ ? { label: "Cancelled", tone: "void" } : paid ? { label: "Paid", tone: "paid" } : { label: titleCase(order.status), tone: "pending" },
      details,
      note: null,
    },
  };
}

async function loadPayment(store: StoreLike, id: string, money: Money, when: When): Promise<LoadResult> {
  const payment = await prisma.payment.findFirst({
    where: {
      id,
      // Platform-side charges (subscriptions, plugins) are BizNest's receipts, not the vendor's.
      purpose: { notIn: ["SUBSCRIPTION_UPGRADE", "SUBSCRIPTION_RENEWAL", "PLUGIN_PURCHASE", "AD_CAMPAIGN"] },
      OR: [
        { storeId: store.id },
        { order: { storeId: store.id } },
        { booking: { storeId: store.id } },
        { reservation: { storeId: store.id } },
        { invoice: { storeId: store.id } },
      ],
    },
    include: {
      order: {
        include: {
          buyer: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true } }, service: { select: { name: true } } } },
        },
      },
      booking: { include: { service: { select: { name: true } }, buyer: { select: { name: true, email: true } } } },
      invoice: { include: { items: true, customer: { select: { name: true, email: true } } } },
    },
  });
  if (!payment) return { ok: false, error: "Payment not found.", status: 404 };

  const amount = Number(payment.amount);
  const lines: ReceiptData["lines"] = [];
  let customer: ReceiptData["customer"] = { name: null, email: null, phone: null, address: null };
  let forWhat = titleCase(payment.purpose);

  if (payment.order) {
    forWhat = `Order #${payment.order.id.slice(-8).toUpperCase()}`;
    const address = payment.order.shippingAddress as { fullName?: string; phone?: string } | null;
    customer =
      payment.order.channel === "POS"
        ? { name: payment.order.posCustomerName ?? "Walk-in customer", email: null, phone: payment.order.posCustomerPhone ?? null, address: null }
        : { name: address?.fullName ?? payment.order.buyer.name, email: payment.order.buyer.email, phone: address?.phone ?? null, address: addressText(payment.order.shippingAddress) };
    for (const item of payment.order.items) {
      lines.push({
        description: item.product?.name ?? item.service?.name ?? "Item",
        qty: item.quantity,
        unit: money(Number(item.unitPrice)),
        amount: money(Number(item.unitPrice) * item.quantity),
      });
    }
  } else if (payment.invoice) {
    forWhat = `Invoice ${payment.invoice.invoiceNo}`;
    customer = {
      name: payment.invoice.customerName ?? payment.invoice.customer?.name ?? null,
      email: payment.invoice.customerEmail ?? payment.invoice.customer?.email ?? null,
      phone: payment.invoice.customerPhone ?? null,
      address: null,
    };
    for (const item of payment.invoice.items) {
      lines.push({ description: item.description, qty: item.quantity, unit: money(Number(item.unitPrice)), amount: money(Number(item.unitPrice) * item.quantity) });
    }
  } else if (payment.booking) {
    forWhat = `Booking: ${payment.booking.service?.name ?? "Service"}`;
    customer = {
      name: payment.booking.guestName ?? payment.booking.buyer?.name ?? null,
      email: payment.booking.guestEmail ?? payment.booking.buyer?.email ?? null,
      phone: payment.booking.guestPhone ?? null,
      address: null,
    };
  }

  // Deposits and part-payments don't cover every line above, so the receipt always states the
  // amount of THIS payment as the headline figure rather than recomputing it from the lines.
  if (lines.length === 0) lines.push({ description: forWhat, qty: 1, unit: money(amount), amount: money(amount) });

  const refunded = Number(payment.refundedAmount ?? 0);
  const totals: ReceiptData["totals"] = [{ label: "Amount received", value: money(amount), strong: true }];
  if (refunded > 0) totals.push({ label: "Refunded", value: `-${money(refunded)}` });

  const status: ReceiptData["status"] =
    payment.status === "SUCCESSFUL"
      ? { label: "Payment received", tone: "paid" }
      : payment.status === "PENDING"
        ? { label: "Pending", tone: "pending" }
        : { label: titleCase(payment.status), tone: "void" };

  const details: ReceiptData["details"] = [
    { label: "Payment for", value: forWhat },
    { label: "Method", value: PROVIDER_LABEL[payment.provider] ?? payment.provider },
    { label: "Reference", value: payment.reference },
  ];
  if (payment.verifiedAt) details.push({ label: "Confirmed", value: when(payment.verifiedAt) });

  return {
    ok: true,
    receipt: {
      kind: "payment",
      heading: "Payment receipt",
      number: payment.reference.length > 18 ? `…${payment.reference.slice(-12)}` : payment.reference,
      issuedAt: when(payment.verifiedAt ?? payment.createdAt),
      store: storeBlock(store),
      customer,
      lines,
      totals,
      status,
      details,
      note: null,
    },
  };
}

async function loadBill(store: StoreLike, id: string, money: Money, when: When): Promise<LoadResult> {
  const invoice = await prisma.invoice.findFirst({
    where: { id, storeId: store.id },
    include: { items: true, customer: { select: { name: true, email: true } }, payment: { select: { provider: true, reference: true } } },
  });
  if (!invoice) return { ok: false, error: "Bill not found.", status: 404 };

  const subtotal = Number(invoice.subtotal);
  const tax = Number(invoice.tax);
  const discount = Number(invoice.discount);
  const deliveryFee = Number(invoice.deliveryFee);
  const totals: ReceiptData["totals"] = [{ label: "Subtotal", value: money(subtotal) }];
  if (discount > 0) totals.push({ label: "Discount", value: `-${money(discount)}` });
  if (deliveryFee > 0) totals.push({ label: "Delivery fee", value: money(deliveryFee) });
  if (tax > 0) totals.push({ label: "Tax", value: money(tax) });
  totals.push({ label: invoice.status === "PAID" ? "Total paid" : "Total due", value: money(Number(invoice.total)), strong: true });

  const details: ReceiptData["details"] = [];
  if (invoice.paidAt) details.push({ label: "Paid on", value: when(invoice.paidAt) });
  if (invoice.payment) {
    details.push({ label: "Method", value: PROVIDER_LABEL[invoice.payment.provider] ?? invoice.payment.provider });
    details.push({ label: "Reference", value: invoice.payment.reference });
  }

  const status: ReceiptData["status"] =
    invoice.status === "PAID"
      ? { label: "Paid", tone: "paid" }
      : invoice.status === "CANCELLED"
        ? { label: "Cancelled", tone: "void" }
        : { label: invoice.status === "DRAFT" ? "Draft" : "Unpaid", tone: "pending" };

  return {
    ok: true,
    receipt: {
      kind: "bill",
      heading: invoice.status === "PAID" ? "Bill receipt" : "Bill",
      number: invoice.invoiceNo,
      issuedAt: when(invoice.createdAt),
      store: storeBlock(store),
      customer: {
        name: invoice.customerName ?? invoice.customer?.name ?? null,
        email: invoice.customerEmail ?? invoice.customer?.email ?? null,
        phone: invoice.customerPhone ?? null,
        address: null,
      },
      lines: invoice.items.map((item) => ({
        description: item.description,
        qty: item.quantity,
        unit: money(Number(item.unitPrice)),
        amount: money(Number(item.unitPrice) * item.quantity),
      })),
      totals,
      status,
      details,
      note: null,
    },
  };
}

/** A hotel guest's room bill: every charge posted to the reservation, with what's paid and what's still owing. */
async function loadFolio(store: StoreLike, id: string, money: Money, when: When): Promise<LoadResult> {
  const reservation = await prisma.propertyReservation.findFirst({
    where: { id, storeId: store.id },
    include: {
      room: { select: { name: true, roomType: true } },
      guest: { select: { fullName: true, email: true, phone: true } },
      folioCharges: { where: { status: { not: "VOID" } }, orderBy: { postedAt: "asc" } },
    },
  });
  if (!reservation) return { ok: false, error: "Room bill not found.", status: 404 };

  const charges = reservation.folioCharges;
  const total = charges.reduce((s, c) => s + Number(c.amount), 0);
  const paid = charges.filter((c) => c.status === "PAID").reduce((s, c) => s + Number(c.amount), 0);
  const balance = total - paid;
  const day = (d: Date) => formatDate(d, { locale: store.locale, timeZone: store.timezone, day: "numeric", month: "short", year: "numeric" });

  const totals: ReceiptData["totals"] = [{ label: "Total charges", value: money(total) }];
  if (paid > 0.009) totals.push({ label: "Paid", value: `-${money(paid)}` });
  totals.push({ label: balance > 0.009 ? "Balance due" : "Balance", value: money(Math.max(0, balance)), strong: true });

  return {
    ok: true,
    receipt: {
      kind: "folio",
      heading: "Room bill",
      number: `Room ${reservation.room.name}`,
      issuedAt: when(new Date()),
      store: storeBlock(store),
      customer: { name: reservation.guest.fullName, email: reservation.guest.email, phone: reservation.guest.phone, address: null },
      lines: charges.map((c) => ({
        description: c.category ? `${c.description} (${c.category})` : c.description,
        qty: c.quantity,
        unit: money(Number(c.unitAmount)),
        amount: money(Number(c.amount)),
      })),
      totals,
      status: charges.length === 0 ? { label: "No charges", tone: "pending" } : balance > 0.009 ? { label: "Unpaid", tone: "pending" } : { label: "Paid", tone: "paid" },
      details: [
        { label: "Room", value: `${reservation.room.name} (${reservation.room.roomType})` },
        { label: "Stay", value: `${day(reservation.checkIn)} to ${day(reservation.checkOut)}` },
      ],
      note: null,
    },
  };
}
