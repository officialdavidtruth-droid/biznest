import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";
import { roundMoney } from "@/lib/utils/pricing";
import { formatNumber } from "@/lib/i18n/locale";
import { logError, errorMeta } from "@/lib/observability/log";
import { planReorders, type LowStockItem } from "@/lib/chores/reorders";
import { digestHasActivity, summarizePayouts } from "@/lib/chores/payouts";
import { monthBoundsUtc, previousMonth, type LedgerOrder } from "@/lib/chores/month-end";

const OPEN_PO = ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] as const;
const naira = (n: number, cur = "NGN") => `${cur} ${formatNumber(Math.round(n))}`;

// ---------------------------------------------------------------------------
// 1. Supplier reorders: low stock -> DRAFT purchase orders (never auto-sent)
// ---------------------------------------------------------------------------
export async function draftLowStockReorders() {
  let stores = 0, drafts = 0, lines = 0, failures = 0;

  // Prisma can't compare two columns in a where clause.
  const low = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i."id" FROM "InventoryItem" i
    JOIN "Store" s ON s."id" = i."storeId"
    WHERE i."quantity" <= i."lowStockThreshold" AND s."status" = 'ACTIVE' AND s."marketingOnly" = false
    LIMIT 5000`;
  if (low.length === 0) return { stores, drafts, lines, failures };

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: low.map((l) => l.id) } },
    select: {
      storeId: true, productId: true, quantity: true, lowStockThreshold: true, costPrice: true,
      product: { select: { name: true, supplierLinks: { where: { supplier: { isArchived: false } }, select: { supplierId: true, costPrice: true } } } },
    },
  });

  const byStore = new Map<string, typeof items>();
  for (const i of items) byStore.set(i.storeId, [...(byStore.get(i.storeId) ?? []), i]);

  for (const [storeId, storeItems] of byStore) {
    try {
      const productIds = storeItems.map((i) => i.productId);
      const open = await prisma.purchaseOrderItem.findMany({
        where: { productId: { in: productIds }, purchaseOrder: { storeId, status: { in: [...OPEN_PO] } } },
        select: { productId: true },
      });
      const alreadyOrdered = new Set(open.map((o) => o.productId!).filter(Boolean));

      const lowItems: LowStockItem[] = storeItems.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        quantity: i.quantity,
        threshold: i.lowStockThreshold,
        costPrice: i.costPrice == null ? null : Number(i.costPrice),
        suppliers: i.product.supplierLinks.map((l) => ({ supplierId: l.supplierId, costPrice: l.costPrice == null ? null : Number(l.costPrice) })),
      }));
      const plan = planReorders(lowItems, alreadyOrdered);
      if (plan.orders.length === 0) continue;

      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { slug: true, currency: true, business: { select: { userId: true } } } });
      if (!store) continue;

      for (const order of plan.orders) {
        const subtotal = roundMoney(order.lines.reduce((s, l) => s + l.unitCost * l.quantityOrdered, 0));
        await prisma.$transaction(async (tx) => {
          const s = await tx.store.update({ where: { id: storeId }, data: { nextPoNo: { increment: 1 } } });
          await tx.purchaseOrder.create({
            data: {
              poNumber: `${store.slug.slice(0, 12).toUpperCase()}-PO-${s.nextPoNo - 1}`,
              storeId,
              supplierId: order.supplierId,
              status: "DRAFT",
              currency: store.currency,
              subtotal,
              notes: "Auto-drafted from low-stock alerts. Review quantities and costs, then send.",
              items: { create: order.lines.map((l) => ({ productId: l.productId, description: l.description, quantityOrdered: l.quantityOrdered, unitCost: roundMoney(l.unitCost) })) },
            },
          });
        });
        drafts++;
        lines += order.lines.length;
      }
      stores++;

      const n = plan.orders.length;
      const itemCount = plan.orders.reduce((s, o) => s + o.lines.length, 0);
      const extra = plan.unassigned.length ? ` ${plan.unassigned.length} low-stock item${plan.unassigned.length === 1 ? " has" : "s have"} no supplier linked yet.` : "";
      await notifyUser({
        userId: store.business.userId,
        type: "REORDER_DRAFTS",
        title: `${n} reorder draft${n === 1 ? "" : "s"} ready`,
        body: `${itemCount} low-stock item${itemCount === 1 ? "" : "s"} are drafted into purchase orders. Review and send.${extra}`,
        url: `/store/${store.slug}/admin/purchase-orders`,
      });
    } catch (err) {
      failures++;
      void logError("JOBS", "weekly-chores: reorder drafts failed", errorMeta(err, { storeId }));
    }
  }
  return { stores, drafts, lines, failures };
}

// ---------------------------------------------------------------------------
// 2. Weekly payout reconciliation digest
// ---------------------------------------------------------------------------
export async function sendPayoutDigests(now = new Date()) {
  let sent = 0, failures = 0;
  const since = new Date(now.getTime() - 7 * 86_400_000);

  const rows = await prisma.payout.findMany({
    where: { OR: [{ createdAt: { gte: since } }, { paidAt: { gte: since } }, { status: { in: ["QUEUED", "PROCESSING"] } }] },
    select: { storeId: true, status: true, amount: true, feeAmount: true, currency: true, createdAt: true },
    take: 10_000,
  });
  const byStore = new Map<string, typeof rows>();
  for (const r of rows) byStore.set(r.storeId, [...(byStore.get(r.storeId) ?? []), r]);
  if (byStore.size === 0) return { sent, failures };

  const stores = await prisma.store.findMany({
    where: { id: { in: [...byStore.keys()] }, status: "ACTIVE" },
    select: { id: true, slug: true, business: { select: { userId: true } } },
  });

  for (const store of stores) {
    try {
      const storeRows = byStore.get(store.id)!;
      const cur = storeRows[0].currency;
      const d = summarizePayouts(storeRows.map((r) => ({ status: r.status, amount: Number(r.amount), feeAmount: Number(r.feeAmount), createdAt: r.createdAt })), now);
      if (!digestHasActivity(d)) continue;

      const parts: string[] = [];
      if (d.paidCount) parts.push(`${naira(d.paidTotal, cur)} paid out across ${d.paidCount} payout${d.paidCount === 1 ? "" : "s"} (gateway fees ${naira(d.feesTotal, cur)})`);
      if (d.problemCount) parts.push(`${d.problemCount} failed or reversed (${naira(d.problemTotal, cur)}), not in your bank`);
      if (d.stuckCount) parts.push(`${d.stuckCount} still pending after 48h (${naira(d.stuckTotal, cur)})`);

      await notifyUser({
        userId: store.business.userId,
        type: d.problemCount || d.stuckCount ? "PAYOUT_DIGEST_ATTENTION" : "PAYOUT_DIGEST",
        title: d.problemCount || d.stuckCount ? "Weekly payouts: needs a look" : "Your weekly payouts",
        body: `${parts.join(". ")}.`,
        url: `/store/${store.slug}/admin/payments`,
      });
      sent++;
    } catch (err) {
      failures++;
      void logError("JOBS", "weekly-chores: payout digest failed", errorMeta(err, { storeId: store.id }));
    }
  }
  return { sent, failures };
}

// ---------------------------------------------------------------------------
// 3. Month-end accountant export
// ---------------------------------------------------------------------------
/** Every seller-visible order in the month (store's own timezone) with its payment/payout trail. */
export async function loadMonthLedger(storeId: string, timezone: string, month: string): Promise<LedgerOrder[] | null> {
  const bounds = monthBoundsUtc(month, timezone);
  if (!bounds) return null;

  const orders = await prisma.order.findMany({
    where: { storeId, createdAt: { gte: bounds.start, lt: bounds.end }, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
    orderBy: { createdAt: "asc" },
    take: 20_000,
    select: {
      id: true, createdAt: true, status: true, channel: true, subtotal: true, deliveryFee: true, total: true, currency: true,
      paymentProvider: true, paymentReference: true, posCustomerName: true,
      buyer: { select: { name: true, email: true } },
      payments: { select: { status: true, refundedAmount: true, payout: { select: { amount: true, feeAmount: true, status: true, paidAt: true } } } },
    },
  });

  return orders.map((o) => {
    const refunded = o.payments.reduce((s, p) => s + (p.refundedAmount ? Number(p.refundedAmount) : 0), 0);
    const payout = o.payments.find((p) => p.payout)?.payout ?? null;
    return {
      createdAt: o.createdAt,
      orderId: o.id,
      status: o.status,
      channel: o.channel,
      customer: o.posCustomerName ?? o.buyer?.name ?? o.buyer?.email ?? "",
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.deliveryFee),
      total: Number(o.total),
      currency: o.currency,
      provider: o.paymentProvider ?? null,
      paymentReference: o.paymentReference ?? null,
      refundedAmount: refunded,
      payoutAmount: payout ? Number(payout.amount) : null,
      gatewayFee: payout ? Number(payout.feeAmount) : null,
      payoutStatus: payout?.status ?? null,
      payoutPaidAt: payout?.paidAt ?? null,
    };
  });
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** On the 1st: tell each store that sold last month that its accountant export is ready. */
export async function notifyMonthEndExports(now = new Date()) {
  const month = previousMonth(now);
  const label = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  let notified = 0, failures = 0;

  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE", marketingOnly: false },
    select: { id: true, slug: true, timezone: true, business: { select: { userId: true } } },
    take: 5000,
  });

  for (const store of stores) {
    try {
      const bounds = monthBoundsUtc(month, store.timezone);
      if (!bounds) continue;
      const count = await prisma.order.count({
        where: { storeId: store.id, createdAt: { gte: bounds.start, lt: bounds.end }, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
      });
      if (count === 0) continue;
      await notifyUser({
        userId: store.business.userId,
        type: "MONTH_END_EXPORT",
        title: `${label} sales export is ready`,
        body: `${count} order${count === 1 ? "" : "s"} with payments, gateway fees and payouts in one spreadsheet. Download it for your accountant.`,
        url: `/api/store/${store.slug}/export/month?month=${month}`,
      });
      notified++;
    } catch (err) {
      failures++;
      void logError("JOBS", "month-end-export: notify failed", errorMeta(err, { storeId: store.id }));
    }
  }
  return { month, notified, failures };
}
