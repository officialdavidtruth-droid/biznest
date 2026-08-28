"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeCustomer } from "@/lib/payments/gateway";
import { roundMoney } from "@/lib/utils/pricing";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { Invoice, InvoiceItem } from "@prisma/client";

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

  if (!input.items.length) return { success: false, error: "Add at least one line item." };
  if (!input.customerId && !input.customerName) {
    return { success: false, error: "Provide a customer, or at minimum a customer name." };
  }

  const subtotal = roundMoney(input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
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
        items: { create: input.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) },
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
export async function getInvoiceForCustomer(invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, status: { not: "DRAFT" } },
    include: { items: true, store: { select: { name: true, slug: true, logoUrl: true } } },
  });
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

  const email = invoice.customerEmail ?? invoice.customer?.email;
  const phone = invoice.customerPhone ?? invoice.customer?.phone;
  const viewUrl = `${APP_URL}/invoices/${invoice.id}`;

  if ((via === "email" || via === "both") && email) {
    await sendOrderNotificationEmail(
      email,
      `Invoice ${invoice.invoiceNo} from ${access.store.name}`,
      `You have a new invoice for ${invoice.currency} ${Number(invoice.total).toLocaleString()}. View and pay it here: <a href="${viewUrl}">${viewUrl}</a>`
    );
  }

  let whatsappUrl: string | undefined;
  if ((via === "whatsapp" || via === "both") && phone) {
    const message = encodeURIComponent(
      `Invoice ${invoice.invoiceNo} from ${access.store.name}: ${invoice.currency} ${Number(invoice.total).toLocaleString()}. Pay here: ${viewUrl}`
    );
    whatsappUrl = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${message}`;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: new Date(), sentVia: via },
  });

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  return { success: true, data: { whatsappUrl } };
}

// --- Payment -------------------------------------------------------------

/** Customer-facing: starts a real gateway charge for the invoice total. */
export async function payInvoice(invoiceId: string): Promise<ActionResult<{ authorizationUrl: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to pay this invoice." };

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { store: true } });
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "PAID") return { success: false, error: "This invoice has already been paid." };
  if (invoice.status === "CANCELLED") return { success: false, error: "This invoice was cancelled." };

  // Reference prefix "INV-" tells the shared payment webhook/callback
  // routes to settle this as an invoice rather than an order — see
  // settleInvoicePayment below and lib/payments/settle.ts.
  const reference = `INV-${invoice.id}-${Math.random().toString(36).slice(2, 8)}`;

  const charge = await chargeCustomer({
    email: session.user.email ?? "guest@biznest.space",
    amountNaira: Number(invoice.total),
    reference,
    callbackUrl: `${APP_URL}/api/payments/paystack/callback`,
    paystackSubaccountCode: invoice.store.paystackSubaccountCode,
    flutterwaveSubaccountId: invoice.store.flutterwaveSubaccountId,
  });
  if (!charge.success) return { success: false, error: charge.error };

  await prisma.payment.create({
    data: {
      storeId: invoice.storeId,
      purpose: "INVOICE",
      provider: charge.gateway,
      reference,
      status: "PENDING",
      amount: Number(invoice.total),
      currency: invoice.currency,
      splitSubaccountCode: charge.splitSubaccountCode,
    },
  });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

/**
 * Merchant manually marks an invoice paid (cash, bank transfer, etc. paid
 * outside the gateway) — the common case for service businesses who
 * collected payment offline.
 */
export async function markInvoicePaid(slug: string, invoiceId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, storeId: access.store.id } });
  if (!invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "PAID") return { success: false, error: "Already marked paid." };

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } });

  revalidatePath(`/store/${slug}/admin/invoices/${invoiceId}`);
  return { success: true, data: undefined };
}

/**
 * Called by the payment webhook/callback routes once a gateway charge with
 * an "INV-" reference verifies successfully. Idempotent: only transitions
 * an invoice still awaiting payment, keyed off the Payment row's own
 * affected-row count rather than a prior read, matching the Order
 * settlement pattern in the same routes.
 */
export async function settleInvoicePayment(reference: string, rawPayload: object): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.purpose !== "INVOICE" || !reference.startsWith("INV-")) return;

  const invoiceId = reference.split("-")[1];
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === "PAID") return;

  const paymentResult = await prisma.payment.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
  });
  if (paymentResult.count === 0) return;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date(), paymentId: payment.id },
  });
}
