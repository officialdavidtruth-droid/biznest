"use server";

import { auth } from "@/lib/auth";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { roundMoney } from "@/lib/utils/pricing";
import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { formatNumber } from "@/lib/i18n/locale";
import { signDocToken, verifyDocToken } from "@/lib/documents/share-token";
import { isCustomerOfStore } from "@/lib/access/store-customer";
import { cleanLines, parseOptionalDate, validateContact, validateLines, validateOptionalAmount } from "@/lib/utils/document-validation";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

const quoteToken = (quoteId: string) => signDocToken("quote", quoteId);
const verifyQuoteToken = (quoteId: string, token: string) => verifyDocToken("quote", quoteId, token);

// Quotes live under the "orders" permission in the nav (dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "orders");
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

  const invalid = validateLines(input.items) ?? validateContact(input) ?? validateOptionalAmount("Deposit", input.depositRequired);
  if (invalid) return { success: false, error: invalid };
  if (!input.customerId && !input.customerName) {
    return { success: false, error: "Provide a customer, or at minimum a customer name." };
  }
  const expires = parseOptionalDate(input.expiresAt);
  if (!expires.ok) return { success: false, error: "The expiry date isn't valid." };
  // customerId arrives from the client: only accept a customer this store actually has.
  if (input.customerId && !(await isCustomerOfStore(access.store.id, input.customerId))) {
    return { success: false, error: "That customer doesn't belong to this store." };
  }
  const items = cleanLines(input.items);

  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
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
        expiresAt: expires.date,
        items: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) },
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
    include: {
      items: true,
      customer: { select: { name: true, email: true } },
      creativeProject: { select: { id: true, projectNo: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    // Same reasoning as listOrders/listProducts: no pagination UI here yet,
    // so bound it rather than let the page slow down as quotes accumulate.
    take: 200,
  });
}

export async function getQuote(slug: string, quoteId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.quote.findFirst({
    where: { id: quoteId, storeId: access.store.id },
    include: {
      items: true,
      creativeProject: {
        select: {
          id: true,
          projectNo: true,
          serviceType: true,
          brief: true,
          budget: true,
          deadline: true,
          referenceFiles: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}

/** Customer-facing read, e.g. a link sent via email/WhatsApp. */
export async function getQuoteForCustomer(quoteId: string, token?: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, status: { not: "DRAFT" } },
    include: { items: true, store: { select: { name: true, slug: true, logoUrl: true } }, order: { select: { id: true, status: true, total: true } } },
  });
  if (!quote) return null;
  if (token && await verifyQuoteToken(quoteId, token)) return quote;
  const session = await auth();
  if (session?.user?.email && quote.customerEmail && session.user.email.toLowerCase() === quote.customerEmail.toLowerCase()) return quote;
  if (session?.user?.id && quote.customerId === session.user.id) return quote;
  return null;
}

/** Merchant-facing: the same tokenised customer link that sendQuote emails, for "Copy link". */
export async function getQuoteShareLink(slug: string, quoteId: string): Promise<ActionResult<{ url: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, storeId: access.store.id }, select: { id: true, status: true } });
  if (!quote) return { success: false, error: "Quote not found." };
  if (quote.status === "DRAFT") return { success: false, error: "Send the quote first to get a customer link." };

  return { success: true, data: { url: `${APP_URL}/quotes/${quote.id}?token=${encodeURIComponent(await quoteToken(quote.id))}` } };
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
  const viewUrl = `${APP_URL}/quotes/${quote.id}?token=${encodeURIComponent(await quoteToken(quote.id))}`;

  if ((via === "email" || via === "both") && email) {
    await sendOrderNotificationEmail(
      email,
      `Quote ${quote.quoteNo} from ${access.store.name}`,
      `You have a new quote for ${quote.currency} ${formatNumber(Number(quote.total))}. Review and accept it here: <a href="${viewUrl}">${viewUrl}</a>`,
      storeEmailBrand(access.store)
    );
  }

  let whatsappUrl: string | undefined;
  if ((via === "whatsapp" || via === "both") && phone) {
    const message = encodeURIComponent(
      `Quote ${quote.quoteNo} from ${access.store.name}: ${quote.currency} ${formatNumber(Number(quote.total))}. Review here: ${viewUrl}`
    );
    whatsappUrl = whatsappLink(phone, decodeURIComponent(message)) ?? undefined;
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
  if (quote.customerId && quote.customerId !== session.user.id) return { success: false, error: "This quote is assigned to another customer." };
  if (!quote.customerId && quote.customerEmail && session.user.email && quote.customerEmail.toLowerCase() !== session.user.email.toLowerCase()) return { success: false, error: "This quote was sent to a different email address." };
  if (quote.status === "ACCEPTED") return { success: false, error: "This quote has already been accepted." };
  if (quote.status === "DECLINED" || quote.status === "EXPIRED") return { success: false, error: "This quote is no longer available." };
  // Drafts are hidden from the customer page, but the action is callable with just an id.
  if (quote.status !== "SENT") return { success: false, error: "This quote isn't open for acceptance yet." };
  if (quote.expiresAt && quote.expiresAt < new Date()) {
    await prisma.quote.update({ where: { id: quoteId }, data: { status: "EXPIRED" } });
    return { success: false, error: "This quote has expired." };
  }

  // A store collecting into its own gateway account has no BizNest payout to verify.
  const checkoutGateway = await resolveCheckoutGateway(quote.storeId);
  if (!checkoutGateway.ok) return { success: false, error: checkoutGateway.error };
  if (!checkoutGateway.usesStoreGateway && !quote.store.payoutVerifiedAt) {
    return { success: false, error: "This store's payout account is still pending provider verification. The deposit cannot be accepted yet." };
  }

  if (!quote.depositRequired || Number(quote.depositRequired) <= 0) {
    const order = await convertQuoteToOrder(quote.id, quote.customerId ?? session.user.id);
    // null means a concurrent request already claimed this quote.
    if (!order) return { success: false, error: "This quote has already been accepted." };
    return { success: true, data: { orderId: order.id } };
  }

  // Reference prefix "QDEP-" tells the shared payment webhook/callback
  // routes to settle this as a quote deposit — see settleQuoteDeposit below.
  const reference = `QDEP-${quote.id}-${Math.random().toString(36).slice(2, 8)}`;
  const gateway = checkoutGateway.gateway;
  await createPendingPayment({ storeId: quote.storeId, purpose: "QUOTE_DEPOSIT", provider: gateway, reference, amount: Number(quote.depositRequired), currency: quote.currency, usesStoreGateway: checkoutGateway.usesStoreGateway });

  const charge = await chargeCustomer({
    email: session.user.email ?? quote.customerEmail ?? "guest@biznest.space",
    amountNaira: Number(quote.depositRequired),
    reference,
    callbackUrl: paymentCallbackUrl(gateway),
    storeId: quote.storeId,
    paystackSubaccountCode: quote.store.paystackSubaccountCode,
    flutterwaveSubaccountId: quote.store.flutterwaveSubaccountId,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }

  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });

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
  if (quote.customerId && quote.customerId !== session.user.id) return { success: false, error: "This quote is assigned to another customer." };
  if (!quote.customerId && quote.customerEmail && session.user.email && quote.customerEmail.toLowerCase() !== session.user.email.toLowerCase()) return { success: false, error: "This quote was sent to a different email address." };

  // Only an open quote can be declined. Without this, a customer could flip an
  // ACCEPTED quote (deposit paid, order created) to DECLINED.
  if (quote.status === "ACCEPTED") return { success: false, error: "This quote has already been accepted." };
  if (quote.status !== "SENT") return { success: false, error: "This quote is no longer open." };

  // Conditional write so a concurrent acceptance can't be overwritten.
  const updated = await prisma.quote.updateMany({ where: { id: quoteId, status: "SENT" }, data: { status: "DECLINED", respondedAt: new Date() } });
  if (updated.count === 0) return { success: false, error: "This quote is no longer open." };
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
    // Claim the quote first with a conditional write. Two near-simultaneous
    // accepts both pass the status check in acceptQuote, but only one can flip
    // SENT -> ACCEPTED; the loser gets count 0 and must not create an order.
    const claimed = await tx.quote.updateMany({
      where: { id: quoteId, status: "SENT" },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    if (claimed.count === 0) return null;

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
      data: { orderId: order.id, customerId: quote.customerId ?? buyerId },
    });

    return order;
  });
}

