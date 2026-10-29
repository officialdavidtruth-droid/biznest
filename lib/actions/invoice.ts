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
import type { Invoice, InvoiceItem } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { formatNumber } from "@/lib/i18n/locale";
import { customerDocUrl, invoiceTokenRequiredFrom, verifyDocToken } from "@/lib/documents/share-token";
import { isCustomerOfStore } from "@/lib/access/store-customer";
import { cleanLines, validateContact, validateLines, validateOptionalAmount } from "@/lib/utils/document-validation";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

// Invoices live under the "orders" permission in the nav (dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "orders");
}

export type InvoiceLineInput = { description: string; quantity: number; unitPrice: number };

export type CreateInvoiceInput = {
  customerId?: string;
  orderId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: InvoiceLineInput[];
  tax?: number;
  discount?: number;
  deliveryFee?: number;
};

// --- Create / read (merchant-facing) --------------------------------------

export async function createInvoice(
  slug: string,
  input: CreateInvoiceInput
): Promise<ActionResult<{ invoiceId: string; invoiceNo: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invalid =
    validateLines(input.items) ??
    validateContact(input) ??
    validateOptionalAmount("Tax", input.tax) ??
    validateOptionalAmount("Discount", input.discount) ??
    validateOptionalAmount("Delivery fee", input.deliveryFee);
  if (invalid) return { success: false, error: invalid };
  if (!input.customerId && !input.customerName) {
    return { success: false, error: "Provide a customer, or at minimum a customer name." };
  }

  // customerId / orderId arrive from the client: only link records that belong to this store.
  if (input.customerId && !(await isCustomerOfStore(access.store.id, input.customerId))) {
    return { success: false, error: "That customer doesn't belong to this store." };
  }
  if (input.orderId) {
    const order = await prisma.order.findFirst({ where: { id: input.orderId, storeId: access.store.id }, select: { id: true } });
    if (!order) return { success: false, error: "That order doesn't belong to this store." };
  }
  const items = cleanLines(input.items);

  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
  const tax = roundMoney(input.tax ?? 0);
  const discount = roundMoney(input.discount ?? 0);
  const deliveryFee = roundMoney(input.deliveryFee ?? 0);
  const total = roundMoney(subtotal + tax - discount + deliveryFee);
  if (total <= 0) return { success: false, error: "Invoice total must be greater than zero." };

  // Increment the store's counter and create the invoice in one
  // transaction so two invoices created back-to-back can never collide on
  // the same number, even under concurrent requests.
  const invoice = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({
      where: { id: access.store.id },
      data: { nextInvoiceNo: { increment: 1 } },
    });
    const invoiceNo = `${store.slug.slice(0, 12).toUpperCase()}-INV-${store.nextInvoiceNo - 1}`;

    return tx.invoice.create({
      data: {
        invoiceNo,
        storeId: access.store.id,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        subtotal,
        tax,
        discount,
        deliveryFee,
        total,
        items: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) },
      },
    });
  });

  revalidatePath(`/store/${slug}/admin/invoices`);
  return { success: true, data: { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo } };
}

export async function listInvoices(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.invoice.findMany({
    where: { storeId: access.store.id },
    include: { items: true, customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    // Same reasoning as listOrders/listProducts: no pagination UI here yet,
    // so bound it rather than let the page slow down as invoices accumulate.
    take: 200,
  });
}

export async function getInvoice(slug: string, invoiceId: string): Promise<(Invoice & { items: InvoiceItem[] }) | null> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.invoice.findFirst({
    where: { id: invoiceId, storeId: access.store.id },
    include: { items: true },
  });
}

/** Customer-facing read, e.g. a link sent via email/WhatsApp — no store-owner auth required, but only ever returns an invoice that's actually been sent. */
export async function getInvoiceForCustomer(invoiceId: string, token?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, status: { not: "DRAFT" } },
    include: { items: true, store: { select: { name: true, slug: true, logoUrl: true } } },
  });
  if (!invoice) return null;

  // Same rules as quotes: a signed link, or the signed-in customer it was raised for.
  if (await verifyDocToken("invoice", invoiceId, token)) return invoice;
  const session = await auth();
  if (session?.user?.id && invoice.customerId === session.user.id) return invoice;
  const customerEmail = invoice.customerEmail?.toLowerCase();
  if (customerEmail && session?.user?.email?.toLowerCase() === customerEmail) return invoice;
  // Optional grandfathering for links emailed before tokens existed (off unless configured).
  const legacyCutoff = invoiceTokenRequiredFrom();
  if (legacyCutoff && invoice.sentAt && invoice.sentAt < legacyCutoff) return invoice;
  return null;
}

/** Merchant-facing: the same tokenised customer link that sendInvoice emails, for "Copy link". */
export async function getInvoiceShareLink(slug: string, invoiceId: string): Promise<ActionResult<{ url: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId: access.store.id }, select: { id: true, status: true } });
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "DRAFT") return { success: false, error: "Send the invoice first to get a customer link." };

  return { success: true, data: { url: await customerDocUrl(APP_URL, "invoice", invoice.id) } };
}

// --- PDF generation --------------------------------------------------------

/**
 * Renders the invoice to PDF bytes via a lightweight internal HTML->PDF
 * route rather than a heavy PDF library in the server-action bundle. See
 * app/api/invoices/[id]/pdf/route.ts for the actual rendering. This action
 * just records that a PDF now exists and returns its URL.
 */
export async function generateInvoicePdf(slug: string, invoiceId: string): Promise<ActionResult<{ pdfUrl: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId: access.store.id } });
  if (!invoice) return { success: false, error: "Invoice not found." };

  const pdfUrl = `${APP_URL}/api/invoices/${invoiceId}/pdf`;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl } });

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  return { success: true, data: { pdfUrl } };
}

// --- Send --------------------------------------------------------------

export async function sendInvoice(
  slug: string,
  invoiceId: string,
  via: "email" | "whatsapp" | "both"
): Promise<ActionResult<{ whatsappUrl?: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, storeId: access.store.id },
    include: { customer: true },
  });
  if (!invoice) return { success: false, error: "Invoice not found." };

  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return { success: false, error: `This invoice is ${invoice.status.toLowerCase()} and can't be sent.` };
  }

  const email = invoice.customerEmail ?? invoice.customer?.email;
  const phone = invoice.customerPhone ?? invoice.customer?.phone;
  const wantsEmail = via === "email" || via === "both";
  const wantsWhatsapp = via === "whatsapp" || via === "both";
  if (wantsEmail && !wantsWhatsapp && !email) return { success: false, error: "This invoice has no customer email address." };
  if (wantsWhatsapp && !wantsEmail && !phone) return { success: false, error: "This invoice has no customer phone number." };
  if (!email && !phone) return { success: false, error: "Add a customer email or phone number before sending." };
  const viewUrl = await customerDocUrl(APP_URL, "invoice", invoice.id);

  let emailed = false;
  if (wantsEmail && email) {
    try {
      await sendOrderNotificationEmail(
        email,
        `Invoice ${invoice.invoiceNo} from ${access.store.name}`,
        `You have a new invoice for ${invoice.currency} ${formatNumber(Number(invoice.total))}. View and pay it here: <a href="${viewUrl}">${viewUrl}</a>`,
        storeEmailBrand(access.store)
      );
      emailed = true;
    } catch {
      if (!wantsWhatsapp) return { success: false, error: "The email couldn't be sent. Please try again." };
    }
  }

  let whatsappUrl: string | undefined;
  if (wantsWhatsapp && phone) {
    whatsappUrl =
      whatsappLink(phone, `Invoice ${invoice.invoiceNo} from ${access.store.name}: ${invoice.currency} ${formatNumber(Number(invoice.total))}. Pay here: ${viewUrl}`) ?? undefined;
  }
  if (!emailed && !whatsappUrl) return { success: false, error: "Couldn't reach the customer with that channel. Check their contact details." };

  // Keep the first sent time: it's when the customer first got the link.
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: invoice.sentAt ?? new Date(), sentVia: via },
  });

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  return { success: true, data: { whatsappUrl } };
}

// --- Payment -------------------------------------------------------------

/** Customer-facing: starts a real gateway charge for the invoice total. */
export async function payInvoice(invoiceId: string, token?: string): Promise<ActionResult<{ authorizationUrl: string }>> {
  const session = await auth();

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { store: true, customer: { select: { email: true } } } });
  if (!invoice) return { success: false, error: "Invoice not found." };

  // The signed link in the invoice email/WhatsApp is itself the authorization to pay,
  // so the customer doesn't need an account. Otherwise it must be their own signed-in invoice.
  const hasValidToken = await verifyDocToken("invoice", invoiceId, token);
  if (!hasValidToken) {
    if (!session?.user?.id) return { success: false, error: "Please open the payment link from your invoice, or sign in, to pay." };
    const sessionEmail = session.user.email?.toLowerCase();
    const invoiceEmail = (invoice.customerEmail ?? invoice.customer?.email)?.toLowerCase();
    const isRecipient = invoice.customerId === session.user.id || (!!sessionEmail && sessionEmail === invoiceEmail);
    if (!isRecipient) return { success: false, error: "This invoice wasn't issued to your account." };
  }
  if (invoice.status === "PAID") return { success: false, error: "This invoice has already been paid." };
  if (invoice.status === "CANCELLED") return { success: false, error: "This invoice was cancelled." };
  // Drafts are hidden from the customer page, but the action is callable with just an id.
  if (invoice.status !== "SENT") return { success: false, error: "This invoice isn't open for payment yet." };

  // A store collecting into its own gateway account has no BizNest payout to verify.
  const checkoutGateway = await resolveCheckoutGateway(invoice.storeId);
  if (!checkoutGateway.ok) return { success: false, error: checkoutGateway.error };
  if (!checkoutGateway.usesStoreGateway && !invoice.store.payoutVerifiedAt) {
    return { success: false, error: "This store's payout account is still pending provider verification. The invoice cannot be paid yet." };
  }

  // Reference prefix "INV-" tells the shared payment webhook/callback
  // routes to settle this as an invoice rather than an order — see
  // settleInvoicePayment below and lib/payments/settle.ts.
  const reference = `INV-${invoice.id}-${Math.random().toString(36).slice(2, 8)}`;
  const gateway = checkoutGateway.gateway;
  await createPendingPayment({ storeId: invoice.storeId, purpose: "INVOICE", provider: gateway, reference, amount: Number(invoice.total), currency: invoice.currency, usesStoreGateway: checkoutGateway.usesStoreGateway });

  const charge = await chargeCustomer({
    email: invoice.customerEmail ?? invoice.customer?.email ?? session?.user?.email ?? "guest@biznest.space",
    amountNaira: Number(invoice.total),
    reference,
    callbackUrl: paymentCallbackUrl(gateway),
    storeId: invoice.storeId,
    paystackSubaccountCode: invoice.store.paystackSubaccountCode,
    flutterwaveSubaccountId: invoice.store.flutterwaveSubaccountId,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }

  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

/**
 * Merchant manually marks an invoice paid (cash, bank transfer, etc. paid
 * outside the gateway) — the common case for service businesses who
 * collected payment offline. Records a CASH Payment row so reports and
 * reconciliation see the money; payout skips CASH (settled outside the platform).
 */
export async function markInvoicePaid(slug: string, invoiceId: string, method?: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId: access.store.id } });
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "PAID") return { success: false, error: "Already marked paid." };
  if (invoice.status === "CANCELLED") return { success: false, error: "This invoice was cancelled." };

  const note = typeof method === "string" ? method.trim().slice(0, 60) : "";
  try {
    await prisma.$transaction(async (tx) => {
      // Claim the invoice first, conditionally: never overwrite a payment that settled (or a cancellation) meanwhile.
      const claimed = await tx.invoice.updateMany({ where: { id: invoiceId, status: { in: ["DRAFT", "SENT"] } }, data: { status: "PAID", paidAt: new Date() } });
      if (claimed.count === 0) throw new Error("INVOICE_NO_LONGER_PAYABLE");

      const payment = await tx.payment.create({
        data: {
          storeId: invoice.storeId,
          purpose: "INVOICE",
          provider: "CASH",
          reference: `MANUAL-INV-${invoice.id}`,
          status: "SUCCESSFUL",
          amount: invoice.total,
          currency: invoice.currency,
          verifiedAt: new Date(),
          rawPayload: { manual: true, method: note || null, markedByUserId: (await auth())?.user?.id ?? null },
        },
      });
      await tx.invoice.update({ where: { id: invoiceId }, data: { paymentId: payment.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_NO_LONGER_PAYABLE") return { success: false, error: "This invoice can no longer be marked paid." };
    throw error;
  }

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  return { success: true, data: undefined };
}

/**
 * Merchant cancels an invoice that hasn't been paid. Conditional write so it can't
 * clobber a payment that settles at the same moment; any later gateway payment on a
 * cancelled invoice is flagged for review/refund by settleInvoicePayment.
 */
export async function cancelInvoice(slug: string, invoiceId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId: access.store.id }, select: { status: true } });
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "PAID") return { success: false, error: "A paid invoice can't be cancelled. Refund the payment instead." };
  if (invoice.status === "CANCELLED") return { success: false, error: "Already cancelled." };

  const updated = await prisma.invoice.updateMany({ where: { id: invoiceId, storeId: access.store.id, status: { in: ["DRAFT", "SENT"] } }, data: { status: "CANCELLED" } });
  if (updated.count === 0) return { success: false, error: "This invoice can no longer be cancelled." };

  // A customer may have started a payment: stop pending attempts from lingering.
  await prisma.payment.updateMany({ where: { purpose: "INVOICE", status: "PENDING", reference: { startsWith: `INV-${invoiceId}-` } }, data: { status: "FAILED" } });

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  return { success: true, data: undefined };
}
