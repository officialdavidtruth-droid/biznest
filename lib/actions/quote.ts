"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeCustomer } from "@/lib/payments/gateway";
import { roundMoney } from "@/lib/utils/pricing";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { Quote, QuoteItem } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false as const, error: "You don't have access to this store." };

  return { success: true as const, store };
}

export type QuoteLineInput = { description: string; quantity: number; unitPrice: number };

export type CreateQuoteInput = {
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: QuoteLineInput[];
  depositRequired?: number;
  expiresAt?: string; // ISO date
};

// --- Create / read (merchant-facing) --------------------------------------

export async function createQuote(
  slug: string,
  input: CreateQuoteInput
): Promise<ActionResult<{ quoteId: string; quoteNo: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!input.items.length) return { success: false, error: "Add at least one line item." };
  if (!input.customerId && !input.customerName) {
    return { success: false, error: "Provide a customer, or at minimum a customer name." };
  }

  const subtotal = roundMoney(input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
  if (subtotal <= 0) return { success: false, error: "Quote total must be greater than zero." };

  if (input.depositRequired != null && input.depositRequired > subtotal) {
    return { success: false, error: "Deposit can't be more than the quote total." };
  }

  const quote = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({
      where: { id: access.store.id },
      data: { nextQuoteNo: { increment: 1 } },
    });
    const quoteNo = `${store.slug.slice(0, 12).toUpperCase()}-Q-${store.nextQuoteNo - 1}`;

    return tx.quote.create({
      data: {
        quoteNo,
        storeId: access.store.id,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        subtotal,
        total: subtotal,
        depositRequired: input.depositRequired != null ? roundMoney(input.depositRequired) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        items: { create: input.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) },
      },
    });
  });

  revalidatePath(`/store/${slug}/admin/quotes`);
  return { success: true, data: { quoteId: quote.id, quoteNo: quote.quoteNo } };
}

export async function listQuotes(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.quote.findMany({
    where: { storeId: access.store.id },
    include: { items: true, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    // Same reasoning as listOrders/listProducts: no pagination UI here yet,
    // so bound it rather than let the page slow down as quotes accumulate.
    take: 200,
  });
}

export async function getQuote(slug: string, quoteId: string): Promise<(Quote & { items: QuoteItem[] }) | null> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.quote.findFirst({ where: { id: quoteId, storeId: access.store.id }, include: { items: true } });
}

/** Customer-facing read, e.g. a link sent via email/WhatsApp. */
export async function getQuoteForCustomer(quoteId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, status: { not: "DRAFT" } },
    include: { items: true, store: { select: { name: true, slug: true, logoUrl: true } } },
  });
}

// --- Send ------------------------------------------------------------------

export async function sendQuote(
  slug: string,
  quoteId: string,
  via: "email" | "whatsapp" | "both"
): Promise<ActionResult<{ whatsappUrl?: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, storeId: access.store.id }, include: { customer: true } });
  if (!quote) return { success: false, error: "Quote not found." };

  const email = quote.customerEmail ?? quote.customer?.email;
  const phone = quote.customerPhone ?? quote.customer?.phone;
  const viewUrl = `${APP_URL}/quotes/${quote.id}`;

  if ((via === "email" || via === "both") && email) {
    await sendOrderNotificationEmail(
      email,
      `Quote ${quote.quoteNo} from ${access.store.name}`,
      `You have a new quote for ${quote.currency} ${Number(quote.total).toLocaleString()}. Review and accept it here: <a href="${viewUrl}">${viewUrl}</a>`
    );
  }

  let whatsappUrl: string | undefined;
  if ((via === "whatsapp" || via === "both") && phone) {
    const message = encodeURIComponent(
      `Quote ${quote.quoteNo} from ${access.store.name}: ${quote.currency} ${Number(quote.total).toLocaleString()}. Review here: ${viewUrl}`
    );
    whatsappUrl = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${message}`;
  }

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: quote.status === "DRAFT" ? "SENT" : quote.status, sentAt: new Date() },
  });

  revalidatePath(`/store/${slug}/admin/quotes/${quoteId}`);
  return { success: true, data: { whatsappUrl } };
}

// --- Accept + deposit (customer-facing) -------------------------------------

/**
 * Customer accepts a quote. If a deposit is required, this starts a real
 * gateway charge for the deposit amount rather than marking the quote
 * ACCEPTED outright — acceptance is only final once the deposit clears (see
 * settleQuoteDeposit below), matching how a photographer wouldn't actually
 * book the date until money changes hands. If no deposit is required, the
 * quote is accepted and converted to an Order immediately.
 */
export async function acceptQuote(quoteId: string): Promise<ActionResult<{ authorizationUrl?: string; orderId?: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to accept this quote." };

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { store: true, items: true } });
  if (!quote) return { success: false, error: "Quote not found." };
  if (quote.status === "ACCEPTED") return { success: false, error: "This quote has already been accepted." };
  if (quote.status === "DECLINED" || quote.status === "EXPIRED") return { success: false, error: "This quote is no longer available." };
  if (quote.expiresAt && quote.expiresAt < new Date()) {
    await prisma.quote.update({ where: { id: quoteId }, data: { status: "EXPIRED" } });
    return { success: false, error: "This quote has expired." };
  }

  if (!quote.depositRequired || Number(quote.depositRequired) <= 0) {
    const order = await convertQuoteToOrder(quote.id, quote.customerId ?? session.user.id);
    return { success: true, data: { orderId: order.id } };
  }

  // Reference prefix "QDEP-" tells the shared payment webhook/callback
  // routes to settle this as a quote deposit — see settleQuoteDeposit below.
  const reference = `QDEP-${quote.id}-${Math.random().toString(36).slice(2, 8)}`;

  const charge = await chargeCustomer({
    email: session.user.email ?? quote.customerEmail ?? "guest@biznest.space",
    amountNaira: Number(quote.depositRequired),
    reference,
    callbackUrl: `${APP_URL}/api/payments/paystack/callback`,
    paystackSubaccountCode: quote.store.paystackSubaccountCode,
    flutterwaveSubaccountId: quote.store.flutterwaveSubaccountId,
  });
  if (!charge.success) return { success: false, error: charge.error };

  await prisma.payment.create({
    data: {
      storeId: quote.storeId,
      purpose: "QUOTE_DEPOSIT",
      provider: charge.gateway,
      reference,
      status: "PENDING",
      amount: Number(quote.depositRequired),
      currency: quote.currency,
      splitSubaccountCode: charge.splitSubaccountCode,
    },
  });

  // Remember which signed-in customer is accepting, in case the quote was
  // only addressed by name/email so far.
  if (!quote.customerId) {
    await prisma.quote.update({ where: { id: quoteId }, data: { customerId: session.user.id } });
  }

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

export async function declineQuote(quoteId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in." };

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return { success: false, error: "Quote not found." };

  await prisma.quote.update({ where: { id: quoteId }, data: { status: "DECLINED", respondedAt: new Date() } });
  return { success: true, data: undefined };
}

// --- Internal: quote -> order conversion -----------------------------------

/**
 * Creates the real Order a quote converts into once accepted (deposit-paid
 * or deposit-free). Shared by acceptQuote's no-deposit path and
 * settleQuoteDeposit's payment-confirmed path so there's exactly one place
 * that does this conversion.
 */
async function convertQuoteToOrder(quoteId: string, buyerId: string) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } });

    const order = await tx.order.create({
      data: {
        storeId: quote.storeId,
        buyerId,
        status: "PENDING_PAYMENT",
        subtotal: quote.subtotal,
        total: quote.total,
        currency: quote.currency,
        items: {
          create: quote.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
        },
      },
    });

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED", respondedAt: new Date(), orderId: order.id, customerId: quote.customerId ?? buyerId },
    });

    return order;
  });
}

/**
 * Called by the payment webhook/callback routes once a gateway charge with
 * a "QDEP-" reference verifies successfully. Idempotent: bails out if the
 * quote is already ACCEPTED (e.g. a webhook retry racing the browser
 * callback), matching the settlement pattern used for Orders and Invoices
 * in the same routes.
 */
export async function settleQuoteDeposit(reference: string, rawPayload: object): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.purpose !== "QUOTE_DEPOSIT" || !reference.startsWith("QDEP-")) return;

  const quoteId = reference.split("-")[1];
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.status === "ACCEPTED") return;

  const paymentResult = await prisma.payment.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
  });
  if (paymentResult.count === 0) return;

  const order = await convertQuoteToOrder(quoteId, quote.customerId!);
  await prisma.quote.update({ where: { id: quoteId }, data: { depositPaymentId: payment.id } });
  await prisma.order.update({ where: { id: order.id }, data: { paymentProvider: payment.provider } });
}
