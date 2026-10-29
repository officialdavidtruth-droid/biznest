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
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { signDocToken, verifyDocToken } from "@/lib/documents/share-token";
import { isCustomerOfStore } from "@/lib/access/store-customer";
import { effectiveQuoteStatus, expireLapsedQuotes, isQuoteLapsed, notLapsedWhere } from "@/lib/quotes/expiry";
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

export type UpdateQuoteInput = {
  items: QuoteLineInput[];
  depositRequired?: number | null;
  expiresAt?: string; // ISO date; empty keeps a sent quote on the default validity window
};

// A quote with no expiry would stay acceptable forever, so one is applied when it is sent.
const DEFAULT_QUOTE_VALIDITY_DAYS = 30;
const DAY_MS = 86_400_000;
const defaultExpiry = () => new Date(Date.now() + DEFAULT_QUOTE_VALIDITY_DAYS * DAY_MS);

// A bare "YYYY-MM-DD" from a date input means "valid through the end of that day".
// Nigeria is UTC+1 year-round, so 22:59:59.999Z is 23:59:59.999 WAT.
function parseExpiry(value: string | undefined): { ok: true; date: Date | null } | { ok: false } {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) value = `${value}T22:59:59.999Z`;
  return parseOptionalDate(value);
}

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
  const expires = parseExpiry(input.expiresAt);
  if (!expires.ok) return { success: false, error: "The expiry date isn't valid." };
  if (expires.date && expires.date <= new Date()) return { success: false, error: "The expiry date must be in the future." };
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
  await expireLapsedQuotes({ storeId: access.store.id });

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
  await expireLapsedQuotes({ id: quoteId, storeId: access.store.id });

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
  await expireLapsedQuotes({ id: quoteId });
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
  // Only an open quote can be (re)sent: sending must never revive a withdrawn, expired,
  // declined or accepted one.
  if (quote.status !== "DRAFT" && quote.status !== "SENT") return { success: false, error: "This quote is closed and can't be sent." };
  if (quote.expiresAt && quote.expiresAt <= new Date()) return { success: false, error: "This quote's expiry date has passed. Edit the expiry date before sending." };
  const expiresAt = quote.expiresAt ?? defaultExpiry();

  const email = quote.customerEmail ?? quote.customer?.email;
  const phone = quote.customerPhone ?? quote.customer?.phone;
  const viewUrl = `${APP_URL}/quotes/${quote.id}?token=${encodeURIComponent(await quoteToken(quote.id))}`;

  if ((via === "email" || via === "both") && email) {
    await sendOrderNotificationEmail(
      email,
      `Quote ${quote.quoteNo} from ${access.store.name}`,
      `You have a new quote for ${quote.currency} ${formatNumber(Number(quote.total))}. Valid until ${formatDate(expiresAt)}. Review and accept it here: <a href="${viewUrl}">${viewUrl}</a>`,
      storeEmailBrand(access.store)
    );
  }

  let whatsappUrl: string | undefined;
  if ((via === "whatsapp" || via === "both") && phone) {
    const message = encodeURIComponent(
      `Quote ${quote.quoteNo} from ${access.store.name}: ${quote.currency} ${formatNumber(Number(quote.total))}. Valid until ${formatDate(expiresAt)}. Review here: ${viewUrl}`
    );
    whatsappUrl = whatsappLink(phone, decodeURIComponent(message)) ?? undefined;
  }

  // Conditional write: a quote withdrawn while this send was running must stay withdrawn.
  await prisma.quote.updateMany({
    where: { id: quoteId, status: { in: ["DRAFT", "SENT"] } },
    data: { status: "SENT", sentAt: new Date(), expiresAt },
  });

  revalidatePath(`/store/${slug}/admin/quotes/${quoteId}`);
  return { success: true, data: { whatsappUrl } };
}

// --- Edit / withdraw (merchant-facing) -------------------------------------

/**
 * Change the prices, deposit or expiry of a quote that hasn't been answered yet
 * (DRAFT or SENT). A sent quote's customer link is unchanged: it shows the new
 * figures straight away, so a wrong price can be corrected without re-issuing.
 */
export async function updateQuote(slug: string, quoteId: string, input: UpdateQuoteInput): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invalid = validateLines(input.items) ?? validateOptionalAmount("Deposit", input.depositRequired);
  if (invalid) return { success: false, error: invalid };
  const expires = parseExpiry(input.expiresAt);
  if (!expires.ok) return { success: false, error: "The expiry date isn't valid." };
  if (expires.date && expires.date <= new Date()) return { success: false, error: "The expiry date must be in the future." };

  const items = cleanLines(input.items);
  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
  if (subtotal <= 0) return { success: false, error: "Quote total must be greater than zero." };
  if (input.depositRequired != null && input.depositRequired > subtotal) {
    return { success: false, error: "Deposit can't be more than the quote total." };
  }
  const deposit = input.depositRequired ? roundMoney(input.depositRequired) : null;

  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findFirst({ where: { id: quoteId, storeId: access.store.id }, select: { status: true } });
    if (!existing) return "NOT_FOUND" as const;
    if (existing.status !== "DRAFT" && existing.status !== "SENT") return "CLOSED" as const;

    // Conditional on the status we just read, so a customer acceptance or a
    // withdrawal that lands in between can't be overwritten.
    const claimed = await tx.quote.updateMany({
      where: { id: quoteId, storeId: access.store.id, status: existing.status },
      data: {
        subtotal,
        total: subtotal,
        depositRequired: deposit,
        expiresAt: expires.date ?? (existing.status === "SENT" ? defaultExpiry() : null),
      },
    });
    if (claimed.count === 0) return "CLOSED" as const;

    await tx.quoteItem.deleteMany({ where: { quoteId } });
    await tx.quoteItem.createMany({
      data: items.map((i) => ({ quoteId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
    return "OK" as const;
  });

  if (outcome === "NOT_FOUND") return { success: false, error: "Quote not found." };
  if (outcome === "CLOSED") return { success: false, error: "This quote has already been answered or closed, so it can't be edited." };

  revalidatePath(`/store/${slug}/admin/quotes`);
  revalidatePath(`/store/${slug}/admin/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true, data: undefined };
}

/**
 * Withdraw a sent quote right now. The customer's link stops accepting it
 * immediately (it shows as expired). Stored as EXPIRED with expiresAt = now, so
 * no schema change is needed.
 */
export async function withdrawQuote(slug: string, quoteId: string): Promise<ActionResult<{ depositInFlight: boolean }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const now = new Date();
  const updated = await prisma.quote.updateMany({
    where: { id: quoteId, storeId: access.store.id, status: "SENT" },
    data: { status: "EXPIRED", expiresAt: now, respondedAt: now },
  });

  if (updated.count === 0) {
    const quote = await prisma.quote.findFirst({ where: { id: quoteId, storeId: access.store.id }, select: { status: true } });
    if (!quote) return { success: false, error: "Quote not found." };
    if (quote.status === "ACCEPTED") return { success: false, error: "The customer already accepted this quote, so it can't be withdrawn." };
    if (quote.status === "DRAFT") return { success: false, error: "This quote hasn't been sent yet." };
    return { success: false, error: "This quote is already closed." };
  }

  // A customer may be mid-payment on the deposit. That payment is flagged for
  // review (see settleQuoteDeposit) rather than creating an order, so tell the merchant.
  const inFlight = await prisma.payment.count({
    where: {
      storeId: access.store.id,
      purpose: "QUOTE_DEPOSIT",
      status: "PENDING",
      reference: { startsWith: `QDEP-${quoteId}-` },
      createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    },
  });

  revalidatePath(`/store/${slug}/admin/quotes`);
  revalidatePath(`/store/${slug}/admin/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true, data: { depositInFlight: inFlight > 0 } };
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
  if (quote.status === "DECLINED" || quote.status === "EXPIRED") return { success: false, error: "This quote is no longer available. The merchant may have withdrawn or replaced it." };
  // Drafts are hidden from the customer page, but the action is callable with just an id.
  if (quote.status !== "SENT") return { success: false, error: "This quote isn't open for acceptance yet." };
  if (isQuoteLapsed(quote)) {
    await expireLapsedQuotes({ id: quoteId });
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
    // null means a concurrent request claimed this quote, or it expired in the meantime.
    if (!order) return { success: false, error: "This quote is no longer open: it was already accepted or has expired." };
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
  if (isQuoteLapsed(quote)) {
    await expireLapsedQuotes({ id: quoteId });
    return { success: false, error: "This quote has expired." };
  }
  if (quote.status !== "SENT") return { success: false, error: "This quote is no longer open." };

  // Conditional write so a concurrent acceptance can't be overwritten.
  const updated = await prisma.quote.updateMany({ where: { id: quoteId, status: "SENT", ...notLapsedWhere() }, data: { status: "DECLINED", respondedAt: new Date() } });
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
      where: { id: quoteId, status: "SENT", ...notLapsedWhere() },
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

