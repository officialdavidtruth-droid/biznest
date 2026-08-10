"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/order";
import { chargeCustomer, getActiveGateway } from "@/lib/payments/gateway";
import { calculateOrderTotals } from "@/lib/utils/pricing";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { OrderStatus, Store, Business } from "@prisma/client";
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

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

// --- Order management (store owner) ------------------------------------

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false, error: "You don't have access to this store." };

  return { success: true, store };
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

  revalidatePath(`/store/${slug}/admin/orders`);
  return { success: true, data: undefined };
}
