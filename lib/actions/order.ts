"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/order";
import { chargeCustomer, getActiveGateway } from "@/lib/payments/gateway";
import { calculateOrderTotals } from "@/lib/utils/pricing";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { OrderStatus, Store, Business, Prisma } from "@prisma/client";
import { awardLoyaltyPointsForOrder } from "@/lib/actions/loyalty";
import { recomputeAndPersistTrustScore } from "@/lib/actions/trust-score";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/actions/activity";
// Which order statuses a seller should ever see (excludes PENDING_PAYMENT /
// CANCELLED carts that were never actually paid for). Lives outside this
// file because a "use server" file may only export async functions — a
// plain const export here breaks the Next.js build.
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

/**
 * Decrements stock for a paid order's line items — physical products and
 * variants only (a line with neither, i.e. a service, is skipped, and a
 * product with no InventoryItem row — e.g. DIGITAL/RENTAL — is a no-op
 * too). Called from inside the same transaction that just flipped an
 * order to PAID (see the four payment callback/webhook routes) — never
 * before, since only a *confirmed* payment should ever consume inventory.
 *
 * Unlike the POS register (lib/actions/pos.ts), which can refuse a sale
 * before any money changes hands, an online order's money has already
 * moved by the time this runs — there's no way to "fail" a sale that's
 * already been charged. So this floors at zero and records what happened
 * (including an "oversold" note on the ledger) rather than rejecting the
 * transaction the way POS does.
 */
export async function decrementStockForOrder(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  for (const item of order.items) {
    if (item.variantId) {
      const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) continue;
      const nextQuantity = Math.max(0, variant.quantity - item.quantity);
      const oversold = item.quantity > variant.quantity;
      const justRanOut = variant.quantity > 0 && nextQuantity === 0;
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { quantity: nextQuantity, autoUnpublished: justRanOut ? true : variant.autoUnpublished },
      });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          storeId: order.storeId,
          type: "SALE",
          quantityChange: -(variant.quantity - nextQuantity),
          quantityAfter: nextQuantity,
          note: oversold
            ? `Online sale (order ${order.id}) — oversold, clamped at 0`
            : `Online sale (order ${order.id})`,
        },
      });
    } else if (item.productId) {
      const inventory = await tx.inventoryItem.findUnique({ where: { productId: item.productId } });
      if (!inventory) continue; // stock not tracked for this product
      const nextQuantity = Math.max(0, inventory.quantity - item.quantity);
      const oversold = item.quantity > inventory.quantity;
      const justRanOut = inventory.quantity > 0 && nextQuantity === 0;
      await tx.inventoryItem.update({
        where: { id: inventory.id },
        data: { quantity: nextQuantity, autoUnpublished: justRanOut ? true : inventory.autoUnpublished },
      });
      if (justRanOut) {
        await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
      }
      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          storeId: order.storeId,
          type: "SALE",
          quantityChange: -(inventory.quantity - nextQuantity),
          quantityAfter: nextQuantity,
          note: oversold
            ? `Online sale (order ${order.id}) — oversold, clamped at 0`
            : `Online sale (order ${order.id})`,
        },
      });
    }
    // item.serviceId (or neither set): not stock-tracked, nothing to do.
  }
}

// --- Checkout (customer-facing) ---------------------------------------

/**
 * Runs (or re-runs) the actual gateway charge for an order and records the
 * result — shared by both the fresh-checkout path and the retry-after-
 * cancelled-attempt path in startCheckout, so the charge/Payment-row logic
 * only exists once. Never creates the Order itself; the caller owns that.
 */
async function chargeExistingOrder(
  order: { id: string; total: unknown; currency: string },
  store: { id: string; slug: string; paystackSubaccountCode: string | null; flutterwaveSubaccountId: string | null },
  shippingFullName: string,
  buyerEmail: string | null | undefined
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const totalNaira = Number(order.total);

  const gateway = await getActiveGateway();
  const callbackUrl =
    gateway === "FLUTTERWAVE"
      ? `${APP_URL}/api/payments/flutterwave/callback`
      : `${APP_URL}/api/payments/paystack/callback`;

  const charge = await chargeCustomer({
    email: buyerEmail ?? "guest@biznest.space",
    customerName: shippingFullName,
    amountNaira: totalNaira,
    reference: order.id,
    callbackUrl,
    paystackSubaccountCode: store.paystackSubaccountCode,
    flutterwaveSubaccountId: store.flutterwaveSubaccountId,
  });

  if (!charge.success) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return { success: false, error: charge.error };
  }

  // Both writes below record the same event (this charge attempt was
  // created) — doing them in one transaction means a failure partway
  // through can never leave an order pointing at a gateway with no
  // matching Payment row for the callback/webhook routes to verify against.
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "PENDING_PAYMENT", paymentProvider: charge.gateway, checkoutUrl: charge.authorizationUrl },
    }),
    // One Payment row per real charge attempt — this is the row the callback
    // and webhook routes verify against and update to SUCCESSFUL/FAILED.
    // Order.paymentProvider/paymentReference above stay as the fast "what
    // actually paid this" pointer; this table is the full audit trail.
    prisma.payment.create({
      data: {
        orderId: order.id,
        storeId: store.id,
        purpose: "ORDER",
        provider: charge.gateway,
        reference: order.id,
        status: "PENDING",
        amount: totalNaira,
        currency: order.currency,
      },
    }),
  ]);

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

export async function startCheckout(
  storeSlug: string,
  input: CheckoutInput
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to check out." };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid checkout details." };
  }
  const data = parsed.data;

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    include: { subscription: true },
  });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This store isn't available." };

  // Re-read prices from the database — never trust amounts from the client.
  const products = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, storeId: store.id, isPublished: true },
  });
  if (products.length !== data.items.length) {
    return { success: false, error: "One or more items in your cart are no longer available." };
  }

  const lines = data.items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return { unitPrice: Number(product.price), quantity: item.quantity };
  });

  let deliveryFeeInput = 0;
  if (data.deliveryZoneId) {
    const zone = await prisma.deliveryZone.findFirst({
      where: { id: data.deliveryZoneId, storeId: store.id, isActive: true },
    });
    if (!zone) return { success: false, error: "That delivery area is no longer available — pick another." };
    deliveryFeeInput = Number(zone.fee);
  }

  const commissionRate = store.subscription ? Number(store.subscription.commissionRate) : 8;
  const { subtotal, deliveryFee, commission, total } = calculateOrderTotals(
    lines,
    deliveryFeeInput,
    commissionRate
  );

  if (subtotal <= 0) return { success: false, error: "Cart total must be greater than zero." };

  // Idempotency guard: the client generates one key per checkout page load
  // and resends it unchanged on every submit attempt for that load
  // (including retries) — see the *-checkout-client.tsx components and
  // checkoutSchema. Order.idempotencyKey is uniquely constrained at the DB
  // level, so this is authoritative, not a heuristic: two submissions with
  // the same key are always the same purchase attempt, even if they land
  // milliseconds apart.
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (existing) {
    if (existing.storeId !== store.id || existing.buyerId !== session.user.id) {
      // A key collision across different stores/buyers should be
      // impossible (the client generates a fresh UUID per page load) —
      // this only fires if something is badly wrong, so fail closed
      // rather than risk acting on someone else's order.
      return { success: false, error: "This checkout session is invalid — please refresh and try again." };
    }
    if (existing.status !== "PENDING_PAYMENT" && existing.status !== "CANCELLED") {
      // Already paid (or further along the fulfillment pipeline) —
      // send the customer straight to their confirmation page instead of
      // anywhere near the gateway again.
      return { success: true, data: { authorizationUrl: `${APP_URL}/${store.slug}/orders/${existing.id}/confirmation` } };
    }
    if (existing.status === "PENDING_PAYMENT" && existing.checkoutUrl) {
      // A charge is already in flight for this exact attempt — hand back
      // the same payment page rather than starting a second charge.
      return { success: true, data: { authorizationUrl: existing.checkoutUrl } };
    }
    // status === "CANCELLED": the previous charge attempt for this exact
    // idempotency key failed (declined card, gateway error, etc). Retry
    // is safe and expected — but must reuse this same order row rather
    // than creating a new one, since idempotencyKey can't be reused.
    return chargeExistingOrder(existing, store, data.shippingAddress.fullName, session.user.email);
  }

  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      buyerId: session.user.id,
      status: "PENDING_PAYMENT",
      subtotal,
      commission,
      total,
      deliveryZoneId: data.deliveryZoneId ?? null,
      deliveryFee,
      currency: products[0]?.currency ?? "NGN",
      shippingAddress: data.shippingAddress,
      idempotencyKey: data.idempotencyKey,
      items: {
        create: data.items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          return { productId: product.id, quantity: item.quantity, unitPrice: product.price };
        }),
      },
    },
  });

  const chargeResult = await chargeExistingOrder(order, store, data.shippingAddress.fullName, session.user.email);
  if (!chargeResult.success) return chargeResult;

  await emitWebhookEvent("ORDER_CREATED", store.id, {
    orderId: order.id,
    storeId: store.id,
    status: order.status,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: order.currency,
  });

  return { success: true, data: { authorizationUrl: chargeResult.data.authorizationUrl } };
}

// --- Order management (store owner) ------------------------------------

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

/**
 * "orders" permission — see product.ts's assertStoreAccess for why this
 * delegates to assertStorePermission instead of the old owner-only check.
 */
export async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const result = await assertStorePermission(slug, "orders");
  if (!result.success) return result;
  return { success: true, store: result.store };
}

export async function getOrderForBuyer(orderId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
    include: {
      items: { include: { product: true, service: true } },
      store: {
        select: {
          name: true, slug: true, logoUrl: true, contactEmail: true, contactPhone: true, socialLinks: true,
          template: { select: { name: true } },
          business: { select: { description: true } },
        },
      },
    },
  });
}

export async function listOrdersForBuyer() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.order.findMany({
    where: { buyerId: session.user.id },
    include: {
      items: { include: { product: true, service: true } },
      store: { select: { name: true, slug: true } },
      dispute: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOrders(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.order.findMany({
    where: { storeId: access.store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
    include: {
      buyer: { select: { name: true, email: true } },
      items: { include: { product: true, service: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(slug: string, orderId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.order.findFirst({
    where: { id: orderId, storeId: access.store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
    include: {
      buyer: { select: { name: true, email: true } },
      items: { include: { product: true, service: true } },
      dispute: true,
    },
  });
}

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: access.store.id } });
  if (!order) return { success: false, error: "Order not found." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      escrowReleasedAt: status === "COMPLETED" ? new Date() : order.escrowReleasedAt,
    },
  });

  // Append-only timeline entry — this is what lets a later dispute's
  // "Delivery information" section show exactly when the seller marked
  // this order delivered/completed, not just Order.updatedAt (which gets
  // overwritten on every subsequent transition).
  await prisma.orderStatusEvent.create({ data: { orderId, status } });

  // Fire-and-forget from the caller's perspective, but awaited here so a
  // failure surfaces in logs rather than silently dropping points -- this
  // never blocks the status update itself since it runs after it commits.
  if (status === "COMPLETED" && order.status !== "COMPLETED") {
    await awardLoyaltyPointsForOrder(orderId);
  }

  // Completed/cancelled/refunded all feed Trust Score factors
  // (completedTransactions, cancellationRate, refundRate) -- refresh the
  // persisted score so marketplace search sort/filter picks it up. Other
  // statuses (e.g. PENDING -> SHIPPED) don't move any factor, so skip the
  // write for those.
  if (status !== order.status && ["COMPLETED", "CANCELLED", "REFUNDED"].includes(status)) {
    await recomputeAndPersistTrustScore(access.store.business.id);
  }

  if (status !== order.status) {
    if (status === "CANCELLED") {
      await emitWebhookEvent("ORDER_CANCELLED", access.store.id, { orderId, status });
    } else if (status === "DELIVERED") {
      await emitWebhookEvent("ORDER_FULFILLED", access.store.id, { orderId, status });
    }
  }

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "order.status_updated",
    target: orderId,
    metadata: { from: order.status, to: status },
  });

  revalidatePath(`/store/${slug}/admin/orders`);
  return { success: true, data: undefined };
}
