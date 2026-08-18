"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/order";
import { chargeCustomer, getActiveGateway } from "@/lib/payments/gateway";
import { calculateOrderTotals } from "@/lib/utils/pricing";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { OrderStatus, Store, Business } from "@prisma/client";
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

// --- Checkout (customer-facing) ---------------------------------------

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
      items: {
        create: data.items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          return { productId: product.id, quantity: item.quantity, unitPrice: product.price };
        }),
      },
    },
  });

  const gateway = await getActiveGateway();
  const callbackUrl =
    gateway === "FLUTTERWAVE"
      ? `${APP_URL}/api/payments/flutterwave/callback`
      : `${APP_URL}/api/payments/paystack/callback`;

  const charge = await chargeCustomer({
    email: session.user.email ?? "guest@biznest.space",
    customerName: data.shippingAddress.fullName,
    amountNaira: total,
    reference: order.id,
    callbackUrl,
    paystackSubaccountCode: store.paystackSubaccountCode,
    flutterwaveSubaccountId: store.flutterwaveSubaccountId,
  });

  if (!charge.success) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return { success: false, error: charge.error };
  }

  await prisma.order.update({ where: { id: order.id }, data: { paymentProvider: charge.gateway } });

  // One Payment row per real charge attempt — this is the row the callback
  // and webhook routes verify against and update to SUCCESSFUL/FAILED.
  // Order.paymentProvider/paymentReference above stay as the fast "what
  // actually paid this" pointer; this table is the full audit trail.
  await prisma.payment.create({
    data: {
      orderId: order.id,
      storeId: store.id,
      purpose: "ORDER",
      provider: charge.gateway,
      reference: order.id,
      status: "PENDING",
      amount: total,
      currency: products[0]?.currency ?? "NGN",
    },
  });

  await emitWebhookEvent("ORDER_CREATED", store.id, {
    orderId: order.id,
    storeId: store.id,
    status: order.status,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: order.currency,
  });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
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
