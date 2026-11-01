import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyUser } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";

const HOUR = 3_600_000;
/** Customer reminder window: unpaid for at least this long... */
const REMIND_AFTER_HOURS = 3;
/** ...and the vendor is told when proof has sat unconfirmed this long. */
const CONFIRM_NUDGE_AFTER_HOURS = 2;
/** Unpaid orders with no proof at all are cancelled after this long (a late payment can still reopen them). */
const CANCEL_AFTER_HOURS = 72;

/**
 * Follow-up for bank-transfer orders (paymentProvider CASH), which the abandoned-checkout job deliberately skips:
 *  1. Vendor nudge: a customer uploaded proof and the vendor hasn't confirmed it. Tells the store owner once
 *     (uses Order.merchantAlertedAt, which is never set for transfer orders by any other job).
 *  2. Customer reminder: the order is unpaid with no proof. Sent once, using a 24h window that matches the daily
 *     schedule, so no extra column is needed.
 *  3. Auto-cancel: no proof after 72h. Stock is not held for transfer orders, so nothing is released, and
 *     settleManualOrderPayment still accepts CANCELLED orders if the customer pays late.
 */
export const GET = withCronMonitor("transfer-order-followup", async () => {
  const start = Date.now();
  const now = Date.now();
  let vendorNudges = 0, customerReminders = 0, cancelled = 0, failures = 0;

  // 1. Vendor nudge
  const awaitingConfirm = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", paymentProvider: "CASH", paymentProofUrl: { not: null }, paymentProofAt: { lt: new Date(now - CONFIRM_NUDGE_AFTER_HOURS * HOUR) }, merchantAlertedAt: null },
    select: { id: true, total: true, currency: true, store: { select: { slug: true, name: true, business: { select: { userId: true } } } } },
    take: 300,
  });
  const byStore = new Map<string, typeof awaitingConfirm>();
  for (const o of awaitingConfirm) byStore.set(o.store.slug, [...(byStore.get(o.store.slug) ?? []), o]);
  for (const orders of byStore.values()) {
    const first = orders[0];
    try {
      const total = orders.reduce((n, o) => n + Number(o.total), 0);
      await notifyUser({
        userId: first.store.business.userId,
        type: "PAYMENT_PROOF",
        title: orders.length === 1 ? "A transfer is waiting for your confirmation" : `${orders.length} transfers are waiting for your confirmation`,
        body: `${first.currency} ${formatNumber(total)} on ${first.store.name}. Customers are waiting. Check your bank and confirm so their orders can be processed.`,
        url: orders.length === 1 ? `/store/${first.store.slug}/admin/orders/${first.id}` : `/store/${first.store.slug}/admin/orders`,
      });
      await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) }, merchantAlertedAt: null }, data: { merchantAlertedAt: new Date() } });
      vendorNudges += orders.length;
    } catch (err) {
      failures++;
      void logError("JOBS", "transfer-order-followup: vendor nudge failed", errorMeta(err, { orderId: first.id }));
    }
  }

  // 2. Customer reminder
  const toRemind = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT", paymentProvider: "CASH", paymentProofUrl: null,
      createdAt: { lt: new Date(now - REMIND_AFTER_HOURS * HOUR), gte: new Date(now - (REMIND_AFTER_HOURS + 24) * HOUR) },
    },
    select: { id: true, buyerId: true, total: true, currency: true, checkoutUrl: true, store: { select: { slug: true, name: true } } },
    take: 500,
  });
  for (const o of toRemind) {
    try {
      await notifyUser({
        userId: o.buyerId,
        type: "ORDER_PAYMENT_REMINDER",
        title: `Finish your order from ${o.store.name}`,
        body: `Your order of ${o.currency} ${formatNumber(Number(o.total))} is waiting. Pay by bank transfer and upload your proof of payment to complete it.`,
        url: o.checkoutUrl ?? `/store/${o.store.slug}/orders/${o.id}/pay`,
      });
      customerReminders++;
    } catch (err) {
      failures++;
      void logError("JOBS", "transfer-order-followup: reminder failed", errorMeta(err, { orderId: o.id }));
    }
  }

  // 3. Auto-cancel
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", paymentProvider: "CASH", paymentProofUrl: null, createdAt: { lt: new Date(now - CANCEL_AFTER_HOURS * HOUR) } },
    select: { id: true },
    take: 500,
  });
  for (const o of stale) {
    try {
      const res = await prisma.order.updateMany({ where: { id: o.id, status: "PENDING_PAYMENT", paymentProvider: "CASH", paymentProofUrl: null }, data: { status: "CANCELLED" } });
      if (res.count === 1) {
        await prisma.orderStatusEvent.create({ data: { orderId: o.id, status: "CANCELLED", note: "No payment received within 3 days" } });
        cancelled++;
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "transfer-order-followup: cancel failed", errorMeta(err, { orderId: o.id }));
    }
  }

  void logInfo("JOBS", "transfer-order-followup completed", { vendorNudges, customerReminders, cancelled, failures }, Date.now() - start);
  return NextResponse.json({ vendorNudges, customerReminders, cancelled, failures });
});
