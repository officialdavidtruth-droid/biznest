"use server";

import { reverseReferralForOrderSafely } from "@/lib/payments/referral-award";
import { computeRecipeRequirements } from "@/lib/fnb-recipe-stock";
import { auth } from "@/lib/auth";
import {
  getStoreCustomerSession,
  getStoreCustomerSessionForStore,
} from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
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
  paymentCallbackUrl,
} from "@/lib/payments/gateway";
import { calculateOrderTotals } from "@/lib/utils/pricing";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants/commission";
import { buildStoreUrl } from "@/lib/store-url";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";
import { settlePrepaidQuoteOrder } from "@/lib/payments/settle-prepaid-order";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyCustomerOfPaidOrder, notifyCustomerOfOrderStatus } from "@/lib/notifications/notify";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import type { ActionResult } from "@/types/actions";
import type {
  OrderStatus,
  Store,
  Business,
} from "@prisma/client";
import {
  awardStoreLoyaltyPointsForOrder,
} from "@/lib/payments/loyalty-award";
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
} from "@/lib/activity-log";
import {
  SELLER_VISIBLE_ORDER_STATUSES,
} from "@/lib/constants/order";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://biznest.vercel.app";

/**
 * What a vendor may see. Normal rule (see SELLER_VISIBLE_ORDER_STATUSES): never an
 * unpaid cart. The one exception: a bank-transfer order whose customer has uploaded
 * proof of payment. That is a real order waiting for the vendor to confirm the money.
 */
const SELLER_VISIBLE_OR_AWAITING_TRANSFER = [
  { status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
  { status: "PENDING_PAYMENT" as const, paymentProvider: "CASH" as const, paymentProofUrl: { not: null } },
];

/**
 * Bank-transfer checkout: no gateway involved. The order stays PENDING_PAYMENT
 * with a CASH ("settled outside the platform") payment row until the vendor
 * confirms the transfer, and the customer is sent to the pay page that shows
 * the vendor's account details and takes the proof-of-payment upload.
 */
async function prepareManualTransferOrder(
  order: { id: string; currency: string },
  store: { id: string; slug: string; customDomain: string | null; customDomainStatus: string },
  totalNaira: number
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const full = await prisma.store.findUnique({ where: { id: store.id } });
  if (!full || !manualPayReady(manualPayInfoFromStore(full))) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return {
      success: false,
      error: "This store hasn't finished setting up how to receive payments yet. Please contact the store.",
    };
  }

  const payUrl = buildStoreUrl(store, `/orders/${order.id}/pay`);

  const existing = await prisma.payment.findUnique({ where: { reference: order.id }, select: { id: true, status: true } });
  if (existing?.status === "SUCCESSFUL") return { success: true, data: { authorizationUrl: payUrl } };
  if (!existing) {
    await createPendingPayment({ storeId: store.id, orderId: order.id, purpose: "ORDER", provider: "CASH", reference: order.id, amount: totalNaira, currency: order.currency });
  } else {
    await prisma.payment.update({ where: { id: existing.id }, data: { provider: "CASH", status: "PENDING", amount: totalNaira, currency: order.currency, usesStoreGateway: false } });
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PENDING_PAYMENT", paymentProvider: "CASH", checkoutUrl: payUrl },
  });
  return { success: true, data: { authorizationUrl: payUrl } };
}

/**
 * Charges an existing order.
 */
async function chargeExistingOrder(
  order: {
    id: string;
    total: unknown;
    currency: string;
    checkoutUrl?: string | null;
  },
  store: {
    id: string;
    slug: string;
    customDomain: string | null;
    customDomainStatus: string;
    paystackSubaccountCode: string | null;
    flutterwaveSubaccountId: string | null;
    payoutVerifiedAt: Date | null;
  },
  shippingFullName: string,
  buyerEmail: string | null | undefined
): Promise<
  ActionResult<{
    authorizationUrl: string;
    inline?: {
      provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
      publicKey: string;
      email: string;
      accessCode?: string;
      reference: string;
      subaccountCode?: string | null;
      subaccountId?: string | null;
      amountNaira?: number;
    };
  }>
> {
  // Order.total less any quote deposit already paid.
  const totalNaira = await getOrderPayableNaira(order.id, order.total);
  if (!(totalNaira > 0)) return { success: false, error: "Nothing is left to pay on this order." };

  // A store charges customers only through ITS OWN Paystack/Flutterwave keys (when the
  // owner has switched them on). Otherwise the customer pays the vendor's bank account
  // directly and uploads proof: BizNest no longer collects store payments itself.
  const ownGateway = await resolveStoreGateway(store.id);
  if (ownGateway.status === "error") return { success: false, error: ownGateway.message };
  if (ownGateway.status === "none") return prepareManualTransferOrder(order, store, totalNaira);

  const gateway = ownGateway.credentials.provider;
  const usesStoreGateway = true;
  const callbackUrl = paymentCallbackUrl(gateway);

  const pendingPayment = await prisma.payment.findUnique({ where: { reference: order.id }, select: { id: true, status: true } });
  if (pendingPayment?.status === "SUCCESSFUL") return { success: true, data: { authorizationUrl: `${APP_URL}/store/${store.slug}/orders/${order.id}/confirmation` } };
  if (pendingPayment?.status === "PENDING" && order.checkoutUrl) {
    return { success: true, data: { authorizationUrl: order.checkoutUrl } };
  }
  if (!pendingPayment) {
    await createPendingPayment({ storeId: store.id, orderId: order.id, purpose: "ORDER", provider: gateway, reference: order.id, amount: totalNaira, currency: order.currency, usesStoreGateway });
  } else if (pendingPayment.status === "FAILED") {
    await prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: "PENDING", provider: gateway, amount: totalNaira, currency: order.currency, usesStoreGateway } });
  }

  const charge =
    await chargeCustomer({
      email:
        buyerEmail ??
        "guest@biznest.space",
      customerName: shippingFullName,
      amountNaira: totalNaira,
      reference: order.id,
      callbackUrl,
      storeId: store.id,
      paystackSubaccountCode:
        store.paystackSubaccountCode,
      flutterwaveSubaccountId:
        store.flutterwaveSubaccountId,
      inline: true,
    });

  if (!charge.success) {
    await markPaymentFailed(order.id);
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

    prisma.payment.update({
      where: { reference: order.id },
      data: { provider: charge.gateway, status: "PENDING", splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false },
    }),
  ]);

  return {
    success: true,
    data: {
      authorizationUrl: charge.authorizationUrl,
      ...(charge.inline ? { inline: charge.inline } : {}),
    },
  };
}

/**
 * Pays the balance of an order created from an accepted quote (the order total
 * less any deposit already paid). Reuses the normal order charge path, so the
 * existing callbacks/webhooks settle it. If the deposit already covers the
 * total, the order is marked paid with no charge.
 */
export async function payQuoteOrderBalance(
  quoteId: string
): Promise<ActionResult<{ authorizationUrl?: string; orderId: string; paid?: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to pay for this quote." };

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { orderId: true, status: true } });
  if (!quote?.orderId || quote.status !== "ACCEPTED") return { success: false, error: "This quote has no order to pay yet." };

  const order = await prisma.order.findUnique({ where: { id: quote.orderId } });
  if (!order || order.buyerId !== session.user.id) return { success: false, error: "This order belongs to another customer." };
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") return { success: false, error: "This order has already been paid." };

  if ((await getOrderPayableNaira(order.id, order.total)) <= 0) {
    const settled = await settlePrepaidQuoteOrder(order.id);
    if (settled.outcome === "paid" || settled.outcome === "already_paid") return { success: true, data: { orderId: order.id, paid: true } };
    return { success: false, error: "We couldn't confirm your deposit yet. Please try again shortly." };
  }

  // A failed earlier attempt cancels the order; reopen it so the customer can retry.
  if (order.status === "CANCELLED") {
    await prisma.order.updateMany({ where: { id: order.id, status: "CANCELLED" }, data: { status: "PENDING_PAYMENT", checkoutUrl: null } });
  }

  const store = await prisma.store.findUnique({ where: { id: order.storeId } });
  if (!store) return { success: false, error: "Store not found." };

  const result = await chargeExistingOrder(
    { id: order.id, total: order.total, currency: order.currency, checkoutUrl: order.status === "CANCELLED" ? null : order.checkoutUrl },
    store,
    session.user.name ?? "Customer",
    session.user.email
  );
  if (!result.success) return result;
  return { success: true, data: { authorizationUrl: result.data.authorizationUrl, orderId: order.id } };
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
    inline?: {
      provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
      publicKey: string;
      email: string;
      accessCode?: string;
      reference: string;
      subaccountCode?: string | null;
      subaccountId?: string | null;
      amountNaira?: number;
    };
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

  // Payment is taken either through the store's OWN gateway keys, or by bank
  // transfer to the vendor's own account. Either way the money never passes
  // through BizNest, so there is no payout target to wait on. A store that has
  // neither set up can't take an order: say so before the customer fills a cart.
  const ownGateway = await resolveStoreGateway(store.id);
  if (ownGateway.status === "error") {
    return { success: false, error: ownGateway.message };
  }
  if (ownGateway.status === "none" && !manualPayReady(manualPayInfoFromStore(store))) {
    return {
      success: false,
      error: "This store hasn't finished setting up how to receive payments yet. Please contact the store.",
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

  const productIds = [...new Set(data.items.map((item) => item.productId))];
  const variantIds = [...new Set(data.items.flatMap((item) => item.variantId ? [item.variantId] : []))];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id, isPublished: true },
    }),
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds }, storeId: store.id, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  if (products.length !== productIds.length) {
    return { success: false, error: "One or more items in your cart are no longer available." };
  }

  const lines: { unitPrice: number; quantity: number }[] = [];
  for (const item of data.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return { success: false, error: "One or more products are no longer available." };
    if (product.hasVariants && !item.variantId) {
      return { success: false, error: `Please choose an option for ${product.name}.` };
    }
    const variant = item.variantId ? variants.find((v) => v.id === item.variantId) : null;
    if (item.variantId && (!variant || variant.productId !== product.id)) {
      return { success: false, error: `The selected option for ${product.name} is no longer available.` };
    }
    // A dish with a recipe is limited by its ingredients, not its own count.
    const recipeNeeds = computeRecipeRequirements(product.attributes, item.quantity);
    if (recipeNeeds) {
      const stock = recipeNeeds.length
        ? await prisma.inventoryItem.findMany({ where: { id: { in: recipeNeeds.map((n) => n.inventoryItemId) }, storeId: store.id }, select: { id: true, quantity: true } })
        : [];
      if (recipeNeeds.some((n) => { const s = stock.find((x) => x.id === n.inventoryItemId); return s && s.quantity < n.quantity; })) {
        return { success: false, error: `${product.name} is not available in that quantity right now.` };
      }
    } else if (variant && variant.quantity < item.quantity) {
      return { success: false, error: `Only ${variant.quantity} of ${variant.label} is available.` };
    }
    if (!variant && !recipeNeeds && product.type === "PHYSICAL") {
      const inventory = await prisma.inventoryItem.findFirst({ where: { productId: product.id, storeId: store.id }, select: { quantity: true } });
      if (inventory && inventory.quantity < item.quantity) {
        return { success: false, error: `Only ${inventory.quantity} of ${product.name} is available.` };
      }
    }
    lines.push({ unitPrice: variant?.price == null ? Number(product.price) : Number(variant.price), quantity: item.quantity });
  }

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

  const commissionRate = PLATFORM_COMMISSION_PERCENT;

  let totals: ReturnType<typeof calculateOrderTotals>;
  try {
    totals = calculateOrderTotals(lines, deliveryFeeInput, commissionRate);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to calculate checkout total." };
  }
  const { subtotal, deliveryFee, commission, total } = totals;

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

  let order: Awaited<ReturnType<typeof prisma.order.create>>;
  try {
    order = await prisma.order.create({
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
                  productId: product.id,
                  variantId: item.variantId ?? null,
                  quantity: item.quantity,
                  unitPrice: item.variantId
                    ? (variants.find((v) => v.id === item.variantId)?.price ?? product.price)
                    : product.price,
                };
              }
            ),
        },
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      const raced = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (raced && raced.storeId === store.id && raced.buyerId === session.user.id) {
        if (raced.status === "PENDING_PAYMENT" && raced.checkoutUrl) return { success: true, data: { authorizationUrl: raced.checkoutUrl } };
        if (raced.status !== "PENDING_PAYMENT" && raced.status !== "CANCELLED") return { success: true, data: { authorizationUrl: `${APP_URL}/store/${store.slug}/orders/${raced.id}/confirmation` } };
        return chargeExistingOrder(raced, store, data.shippingAddress.fullName, session.user.email);
      }
    }
    return { success: false, error: "We couldn't create your order safely. Please try again." };
  }

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
      ...(chargeResult.data.inline ? { inline: chargeResult.data.inline } : {}),
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
              sellsProducts: true,
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

/**
 * The signed-in customer's bank-transfer orders that still need paying or are
 * waiting for the vendor to confirm. Shown above "My orders" so a customer who
 * closed the pay page can get back to it.
 */
export async function listAwaitingTransferOrdersForBuyer(slug: string) {
  const customerSession = await getStoreCustomerSessionForStore(slug);
  const session = customerSession ? customerSession : await auth();
  if (!session?.user?.id) return [];
  return prisma.order.findMany({
    where: { buyerId: session.user.id, store: { slug }, status: "PENDING_PAYMENT", paymentProvider: "CASH" },
    select: { id: true, total: true, currency: true, createdAt: true, paymentProofUrl: true },
    orderBy: { createdAt: "desc" },
    take: 20,
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

      OR: SELLER_VISIBLE_OR_AWAITING_TRANSFER,
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

      OR: SELLER_VISIBLE_OR_AWAITING_TRANSFER,
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
      include: {
        buyer: {
          select: {
            email: true,
          },
        },
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
      ...(status === "PAID" ? { fulfillmentStatus: "NEW", kitchenStatus: "QUEUED" } : {}),
      ...(status === "IN_PROGRESS" ? { fulfillmentStatus: "PREPARING", kitchenStatus: "STARTED" } : {}),
      ...(status === "DELIVERED" ? { fulfillmentStatus: "READY", kitchenStatus: "READY" } : {}),
      ...(status === "COMPLETED" ? { fulfillmentStatus: "FULFILLED", kitchenStatus: "SERVED" } : {}),
      ...(status === "CANCELLED" || status === "REFUNDED" ? { fulfillmentStatus: "CANCELLED", kitchenStatus: "VOIDED" } : {}),
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
    if (order.buyer?.email) {
      await runAutomationsForEvent({
        type: "ORDER_COMPLETED",
        storeId: access.store.id,
        data: { orderId, email: order.buyer.email },
      });
    }
  }

  if (status === "REFUNDED" && order.status !== "REFUNDED") {
    await reverseReferralForOrderSafely(orderId);
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

  if (status !== order.status) {
    void notifyCustomerOfOrderStatus(orderId, status);
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