"use server";

import { auth } from "@/lib/auth";
import {
  getStoreCustomerSession,
  getStoreCustomerSessionForStore,
} from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";
import {
  requireStoreCustomer,
  requireStoreCustomerByStoreId,
} from "@/lib/actions/store-customer";
import {
  checkoutSchema,
  type CheckoutInput,
} from "@/lib/validations/order";
import {
  chargeCustomer,
  getActiveGateway,
} from "@/lib/payments/gateway";
import { calculateOrderTotals } from "@/lib/utils/pricing";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import type { ActionResult } from "@/types/actions";
import type {
  OrderStatus,
  Store,
  Business,
  Prisma,
} from "@prisma/client";
import {
  awardStoreLoyaltyPointsForOrder,
} from "@/lib/actions/loyalty";
import {
  recomputeAndPersistTrustScore,
} from "@/lib/actions/trust-score";
import {
  emitWebhookEvent,
} from "@/lib/webhooks/dispatch";
import {
  assertStorePermission,
} from "@/lib/access/assert-store-access";
import {
  logStoreActivity,
} from "@/lib/actions/activity";
import {
  SELLER_VISIBLE_ORDER_STATUSES,
} from "@/lib/constants/order";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://biznest.vercel.app";

/**
 * Decrements stock for a paid order's line items.
 *
 * Physical products and variants only.
 * Services are not stock-tracked.
 */
export async function decrementStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
    },
  });

  if (!order) return;

  for (const item of order.items) {
    if (item.variantId) {
      const variant =
        await tx.productVariant.findUnique({
          where: {
            id: item.variantId,
          },
        });

      if (!variant) continue;

      const nextQuantity = Math.max(
        0,
        variant.quantity - item.quantity
      );

      const oversold =
        item.quantity > variant.quantity;

      const justRanOut =
        variant.quantity > 0 &&
        nextQuantity === 0;

      await tx.productVariant.update({
        where: {
          id: item.variantId,
        },
        data: {
          quantity: nextQuantity,
          autoUnpublished: justRanOut
            ? true
            : variant.autoUnpublished,
        },
      });

      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          storeId: order.storeId,
          type: "SALE",
          quantityChange:
            -(variant.quantity - nextQuantity),
          quantityAfter: nextQuantity,
          note: oversold
            ? `Online sale (order ${order.id}) — oversold, clamped at 0`
            : `Online sale (order ${order.id})`,
        },
      });
    } else if (item.productId) {
      const inventory =
        await tx.inventoryItem.findUnique({
          where: {
            productId: item.productId,
          },
        });

      if (!inventory) continue;

      const nextQuantity = Math.max(
        0,
        inventory.quantity - item.quantity
      );

      const oversold =
        item.quantity > inventory.quantity;

      const justRanOut =
        inventory.quantity > 0 &&
        nextQuantity === 0;

      await tx.inventoryItem.update({
        where: {
          id: inventory.id,
        },
        data: {
          quantity: nextQuantity,
          autoUnpublished: justRanOut
            ? true
            : inventory.autoUnpublished,
        },
      });

      if (justRanOut) {
        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            isPublished: false,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          storeId: order.storeId,
          type: "SALE",
          quantityChange:
            -(inventory.quantity - nextQuantity),
          quantityAfter: nextQuantity,
          note: oversold
            ? `Online sale (order ${order.id}) — oversold, clamped at 0`
            : `Online sale (order ${order.id})`,
        },
      });
    }
  }
}

/**
 * Charges an existing order.
 */
async function chargeExistingOrder(
  order: {
    id: string;
    total: unknown;
    currency: string;
  },
  store: {
    id: string;
    slug: string;
    paystackSubaccountCode: string | null;
    flutterwaveSubaccountId: string | null;
  },
  shippingFullName: string,
  buyerEmail: string | null | undefined
): Promise<
  ActionResult<{
    authorizationUrl: string;
  }>
> {
  const totalNaira = Number(order.total);

  const gateway =
    await getActiveGateway();

  const callbackUrl =
    gateway === "FLUTTERWAVE"
      ? `${APP_URL}/api/payments/flutterwave/callback`
      : `${APP_URL}/api/payments/paystack/callback`;

  const charge =
    await chargeCustomer({
      email:
        buyerEmail ??
        "guest@biznest.space",
      customerName: shippingFullName,
      amountNaira: totalNaira,
      reference: order.id,
      callbackUrl,
      paystackSubaccountCode:
        store.paystackSubaccountCode,
      flutterwaveSubaccountId:
        store.flutterwaveSubaccountId,
    });

  if (!charge.success) {
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return {
      success: false,
      error: charge.error,
    };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: "PENDING_PAYMENT",
        paymentProvider:
          charge.gateway,
        checkoutUrl:
          charge.authorizationUrl,
      },
    }),

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
        splitSubaccountCode: charge.splitSubaccountCode,
      },
    }),
  ]);

  return {
    success: true,
    data: {
      authorizationUrl:
        charge.authorizationUrl,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* CHECKOUT                                                                    */
/* -------------------------------------------------------------------------- */

export async function startCheckout(
  storeSlug: string,
  input: CheckoutInput
): Promise<
  ActionResult<{
    authorizationUrl: string;
  }>
> {
  const customerSession =
    await getStoreCustomerSession();

  /**
   * IMPORTANT:
   *
   * StoreCustomerSession already has the same shape
   * as the normal auth session:
   *
   * {
   *   user: {
   *     id,
   *     name,
   *     email,
   *     role,
   *     customerStoreId
   *   }
   * }
   */
  const session = customerSession
    ? customerSession
    : await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error:
        "Please sign in to check out.",
    };
  }

  const parsed =
    checkoutSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.errors[0]?.message ??
        "Invalid checkout details.",
    };
  }

  const data = parsed.data;

  const store =
    await prisma.store.findUnique({
      where: {
        slug: storeSlug,
      },
      include: {
        subscription: true,
      },
    });

  if (
    !store ||
    store.status !== "ACTIVE"
  ) {
    return {
      success: false,
      error:
        "This store isn't available.",
    };
  }

  let customerProfileId:
    | string
    | null = null;

  if (
    session.user.role ===
    "CUSTOMER"
  ) {
    const membership =
      await requireStoreCustomerByStoreId(
        store.id
      );

    if (!membership) {
      return {
        success: false,
        error:
          "This customer account belongs to another store. Sign up for this store to continue.",
      };
    }

    const profile =
      await prisma.storeCustomerProfile.findFirst(
        {
          where: {
            userId:
              session.user.id,
            storeId: store.id,
          },
          select: {
            id: true,
          },
        }
      );

    customerProfileId =
      profile?.id ?? null;
  }

  const products =
    await prisma.product.findMany({
      where: {
        id: {
          in: data.items.map(
            (item) =>
              item.productId
          ),
        },
        storeId: store.id,
        isPublished: true,
      },
    });

  if (
    products.length !==
    data.items.length
  ) {
    return {
      success: false,
      error:
        "One or more items in your cart are no longer available.",
    };
  }

  const lines =
    data.items.map((item) => {
      const product =
        products.find(
          (p) =>
            p.id ===
            item.productId
        )!;

      return {
        unitPrice:
          Number(product.price),
        quantity:
          item.quantity,
      };
    });

  let deliveryFeeInput = 0;

  if (data.deliveryZoneId) {
    const zone =
      await prisma.deliveryZone.findFirst(
        {
          where: {
            id:
              data.deliveryZoneId,
            storeId: store.id,
            isActive: true,
          },
        }
      );

    if (!zone) {
      return {
        success: false,
        error:
          "That delivery area is no longer available — pick another.",
      };
    }

    deliveryFeeInput =
      Number(zone.fee);
  }

  const commissionRate =
    store.subscription
      ? Number(
          store.subscription
            .commissionRate
        )
      : 8;

  const {
    subtotal,
    deliveryFee,
    commission,
    total,
  } =
    calculateOrderTotals(
      lines,
      deliveryFeeInput,
      commissionRate
    );

  if (subtotal <= 0) {
    return {
      success: false,
      error:
        "Cart total must be greater than zero.",
    };
  }

  const existing =
    await prisma.order.findUnique({
      where: {
        idempotencyKey:
          data.idempotencyKey,
      },
    });

  if (existing) {
    if (
      existing.storeId !==
        store.id ||
      existing.buyerId !==
        session.user.id
    ) {
      return {
        success: false,
        error:
          "This checkout session is invalid — please refresh and try again.",
      };
    }

    if (
      existing.status !==
        "PENDING_PAYMENT" &&
      existing.status !==
        "CANCELLED"
    ) {
      return {
        success: true,
        data: {
          authorizationUrl:
            `${APP_URL}/${store.slug}/orders/${existing.id}/confirmation`,
        },
      };
    }

    if (
      existing.status ===
        "PENDING_PAYMENT" &&
      existing.checkoutUrl
    ) {
      return {
        success: true,
        data: {
          authorizationUrl:
            existing.checkoutUrl,
        },
      };
    }

    return chargeExistingOrder(
      existing,
      store,
      data.shippingAddress
        .fullName,
      session.user.email
    );
  }

  const order =
    await prisma.order.create({
      data: {
        storeId: store.id,
        buyerId:
          session.user.id,
        customerProfileId,
        status:
          "PENDING_PAYMENT",
        subtotal,
        commission,
        total,
        deliveryZoneId:
          data.deliveryZoneId ??
          null,
        deliveryFee,
        currency:
          products[0]?.currency ??
          "NGN",
        shippingAddress:
          data.shippingAddress,
        idempotencyKey:
          data.idempotencyKey,

        items: {
          create:
            data.items.map(
              (item) => {
                const product =
                  products.find(
                    (p) =>
                      p.id ===
                      item.productId
                  )!;

                return {
                  productId:
                    product.id,
                  quantity:
                    item.quantity,
                  unitPrice:
                    product.price,
                };
              }
            ),
        },
      },
    });

  const chargeResult =
    await chargeExistingOrder(
      order,
      store,
      data.shippingAddress
        .fullName,
      session.user.email
    );

  if (!chargeResult.success) {
    return chargeResult;
  }

  await emitWebhookEvent(
    "ORDER_CREATED",
    store.id,
    {
      orderId: order.id,
      storeId: store.id,
      status: order.status,
      subtotal:
        Number(order.subtotal),
      total:
        Number(order.total),
      currency:
        order.currency,
    }
  );

  return {
    success: true,
    data: {
      authorizationUrl:
        chargeResult.data
          .authorizationUrl,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* STORE ORDER MANAGEMENT                                                      */
/* -------------------------------------------------------------------------- */

type StoreAccessResult =
  | {
      success: true;
      store: Store & {
        business: Business;
      };
    }
  | {
      success: false;
      error: string;
    };

export async function assertStoreAccess(
  slug: string
): Promise<StoreAccessResult> {
  const result =
    await assertStorePermission(
      slug,
      "orders"
    );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    store: result.store,
  };
}

/* -------------------------------------------------------------------------- */
/* BUYER ORDER                                                                 */
/* -------------------------------------------------------------------------- */

export async function getOrderForBuyer(
  orderId: string,
  storeSlug?: string
) {
  const customerSession =
    storeSlug
      ? await getStoreCustomerSessionForStore(
          storeSlug
        )
      : await getStoreCustomerSession();

  const session = customerSession
    ? customerSession
    : await auth();

  if (!session?.user?.id) {
    return null;
  }

  if (
    session.user.role ===
      "CUSTOMER" &&
    storeSlug
  ) {
    const membership =
      await requireStoreCustomer(
        storeSlug
      );

    if (!membership) {
      return null;
    }
  }

  return prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId:
        session.user.id,

      ...(storeSlug
        ? {
            store: {
              slug: storeSlug,
            },
          }
        : {}),
    },

    include: {
      items: {
        include: {
          product: true,
          service: true,
        },
      },

      store: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          contactEmail: true,
          contactPhone: true,
          socialLinks: true,

          template: {
            select: {
              name: true,
            },
          },

          business: {
            select: {
              description: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Lists orders for the currently signed-in buyer.
 *
 * FIX:
 * StoreCustomerSession already contains `user`.
 * Do not access customerSession.id/storeId.
 */
export async function listOrdersForBuyer() {
  const customerSession =
    await getStoreCustomerSession();

  const session = customerSession
    ? customerSession
    : await auth();

  if (!session?.user?.id) {
    return [];
  }

  if (
    session.user.role ===
      "CUSTOMER" &&
    !session.user.customerStoreId
  ) {
    return [];
  }

  return prisma.order.findMany({
    where: {
      buyerId:
        session.user.id,

      ...(session.user.role ===
      "CUSTOMER"
        ? {
            storeId:
              session.user
                .customerStoreId,
          }
        : {}),
    },

    include: {
      items: {
        include: {
          product: true,
          service: true,
        },
      },

      store: {
        select: {
          name: true,
          slug: true,
        },
      },

      dispute: {
        select: {
          id: true,
          status: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    // Same reasoning as listOrders below: a long-time buyer with hundreds of
    // past orders shouldn't force this query to grow unbounded on every
    // "My orders" page load.
    take: 200,
  });
}

/**
 * Lists orders for a buyer at one specific store.
 *
 * FIX:
 * Use getStoreCustomerSessionForStore(slug)
 * instead of getStoreCustomerSession(slug).
 */
export async function listOrdersForBuyerAtStore(
  slug: string
) {
  const customerSession =
    await getStoreCustomerSessionForStore(
      slug
    );

  const session = customerSession
    ? customerSession
    : await auth();

  if (!session?.user?.id) {
    return [];
  }

  if (
    session.user.role ===
    "CUSTOMER"
  ) {
    const membership =
      await requireStoreCustomer(
        slug
      );

    if (!membership) {
      return [];
    }
  }

  return prisma.order.findMany({
    where: {
      buyerId:
        session.user.id,

      store: {
        slug,
      },

      // Unpaid orders are effectively still "in the cart" — a customer who
      // never paid shouldn't see them cluttering their order history. Only
      // orders that were actually paid for (or that reached a terminal
      // cancelled/refunded state) belong in "My orders".
      status: {
        not: "PENDING_PAYMENT",
      },
    },

    include: {
      items: {
        include: {
          product: true,
          service: true,
        },
      },

      store: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          themeColors: true,
        },
      },

      dispute: {
        select: {
          id: true,
          status: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 200,
  });
}

/* -------------------------------------------------------------------------- */
/* SELLER ORDERS                                                              */
/* -------------------------------------------------------------------------- */

export async function listOrders(
  slug: string
) {
  const access =
    await assertStoreAccess(slug);

  if (!access.success) {
    return [];
  }

  return prisma.order.findMany({
    where: {
      storeId:
        access.store.id,

      status: {
        in:
          SELLER_VISIBLE_ORDER_STATUSES,
      },
    },

    include: {
      buyer: {
        select: {
          name: true,
          email: true,
        },
      },

      items: {
        include: {
          product: true,
          service: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    // Bounded on purpose: this page has no pagination UI yet, so without a
    // cap it fetches a store's *entire* order history (with nested item/
    // product/service includes) on every load. Harmless with a handful of
    // orders, but linearly slower as a store grows -- exactly the
    // "increasingly slow" symptom. 200 most-recent orders covers what any
    // seller actually looks at day-to-day; add real pagination when a store
    // needs to look further back than that.
    take: 200,
  });
}

export async function getOrder(
  slug: string,
  orderId: string
) {
  const access =
    await assertStoreAccess(slug);

  if (!access.success) {
    return null;
  }

  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId:
        access.store.id,

      status: {
        in:
          SELLER_VISIBLE_ORDER_STATUSES,
      },
    },

    include: {
      buyer: {
        select: {
          name: true,
          email: true,
        },
      },

      items: {
        include: {
          product: true,
          service: true,
        },
      },

      dispute: true,
    },
  });
}

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const access =
    await assertStoreAccess(slug);

  if (!access.success) {
    return {
      success: false,
      error: access.error,
    };
  }

  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        storeId:
          access.store.id,
      },
    });

  if (!order) {
    return {
      success: false,
      error: "Order not found.",
    };
  }

  await prisma.order.update({
    where: {
      id: orderId,
    },

    data: {
      status,

      escrowReleasedAt:
        status === "COMPLETED"
          ? new Date()
          : order.escrowReleasedAt,
    },
  });

  await prisma.orderStatusEvent.create({
    data: {
      orderId,
      status,
    },
  });

  if (
    status === "COMPLETED" &&
    order.status !== "COMPLETED"
  ) {
    await awardStoreLoyaltyPointsForOrder(
      orderId
    );
  }

  if (
    status !== order.status &&
    [
      "COMPLETED",
      "CANCELLED",
      "REFUNDED",
    ].includes(status)
  ) {
    await recomputeAndPersistTrustScore(
      access.store.business.id
    );
  }

  if (
    status !== order.status
  ) {
    if (
      status === "CANCELLED"
    ) {
      await emitWebhookEvent(
        "ORDER_CANCELLED",
        access.store.id,
        {
          orderId,
          status,
        }
      );
    } else if (
      status === "DELIVERED"
    ) {
      await emitWebhookEvent(
        "ORDER_FULFILLED",
        access.store.id,
        {
          orderId,
          status,
        }
      );
    }
  }

  const session =
    await auth();

  await logStoreActivity({
    storeId:
      access.store.id,

    actor: {
      id: session?.user?.id,
      name:
        session?.user?.name,
      email:
        session?.user?.email,
      role:
        session?.user?.role ??
        "unknown",
    },

    action:
      "order.status_updated",

    target: orderId,

    metadata: {
      from: order.status,
      to: status,
    },
  });

  revalidatePath(
    `/store/${slug}/admin/orders`
  );

  return {
    success: true,
    data: undefined,
  };
}
/**
 * Lets a buyer re-trigger their own order-confirmation email — the safety
 * net for orders placed before the callback-route notification fix (or any
 * other one-off delivery hiccup, e.g. a bounced/misspelled inbox that's
 * since been fixed on their end). Reuses getOrderForBuyer's exact auth
 * check, so a buyer can only resend a receipt for an order that's actually
 * theirs. Capped at 3/hour per order — generous for a genuine "I lost the
 * email" case, tight enough that it can't be used to spam an inbox.
 */
export async function resendOrderConfirmationEmail(
  orderId: string,
  storeSlug?: string
): Promise<ActionResult> {
  const order = await getOrderForBuyer(orderId, storeSlug);
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  if (order.status === "PENDING_PAYMENT" || order.status === "CANCELLED") {
    return { success: false, error: "This order hasn't been paid yet, so there's no confirmation to resend." };
  }

  const rate = await checkRateLimit(`resend-order-confirmation:${orderId}`, 3, 60 * 60 * 1000);
  if (!rate.allowed) {
    return { success: false, error: "You've requested this a few times already — please try again later." };
  }

  await notifyCustomerOfPaidOrder(orderId);

  return { success: true, data: undefined };
}
