"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { prisma } from "@/lib/prisma";
import { chargeCustomer } from "@/lib/payments/gateway";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

async function getCustomer(storeSlug: string) {
  const customerSession = await getStoreCustomerSessionForStore(storeSlug);
  if (customerSession?.user?.id) return { userId: customerSession.user.id, email: customerSession.user.email, name: customerSession.user.name };
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CUSTOMER") return null;
  const membership = await requireStoreCustomer(storeSlug);
  if (!membership) return null;
  return { userId: session.user.id, email: session.user.email, name: session.user.name };
}

export async function getWallet(storeSlug: string) {
  const customer = await getCustomer(storeSlug);
  if (!customer) return null;
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true } });
  if (!store) return null;
  const wallet = await prisma.storeWallet.upsert({
    where: { storeId_userId: { storeId: store.id, userId: customer.userId } },
    create: { storeId: store.id, userId: customer.userId, currency: "NGN" },
    update: {},
  });
  return prisma.storeWallet.findUnique({
    where: { id: wallet.id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
}

export async function startWalletFunding(
  storeSlug: string,
  amountNaira: number
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const customer = await getCustomer(storeSlug);
  if (!customer) return { success: false, error: "Please sign in to use your wallet." };

  const amount = Number(amountNaira);
  if (!Number.isFinite(amount) || amount < 100 || amount > 5000000) {
    return { success: false, error: "Enter an amount between ₦100 and ₦5,000,000." };
  }

  const rate = await checkRateLimit(`wallet-fund:${customer.userId}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many funding attempts. Please wait a few minutes." };

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, status: true },
  });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This store isn't available." };

  const wallet = await prisma.storeWallet.upsert({
    where: { storeId_userId: { storeId: store.id, userId: customer.userId } },
    create: { storeId: store.id, userId: customer.userId, currency: "NGN" },
    update: {},
  });
  if (wallet.status !== "ACTIVE") return { success: false, error: "Your wallet is currently unavailable." };

  const reference = `WAL-${wallet.id}-${crypto.randomUUID()}`;
  const gateway = await import("@/lib/actions/site-settings").then((m) => m.getActiveGateway());
  const callbackUrl = gateway === "FLUTTERWAVE"
    ? `${APP_URL}/api/payments/flutterwave/callback`
    : `${APP_URL}/api/payments/paystack/callback`;

  // Persist the pending charge before calling the provider. If the provider
  // accepts the charge but the request dies immediately afterwards, the
  // reconciliation trail still contains the reference we must investigate.
  await prisma.payment.create({
    data: {
      storeId: store.id,
      walletId: wallet.id,
      purpose: "WALLET_FUNDING",
      provider: gateway,
      reference,
      status: "PENDING",
      amount,
      currency: "NGN",
    },
  });

  const charge = await chargeCustomer({
    email: customer.email ?? `customer-${customer.userId}@wallet.biznest.space`,
    customerName: customer.name ?? customer.email ?? "BizNest customer",
    amountNaira: amount,
    reference,
    callbackUrl,
    gateway,
  });
  if (!charge.success) {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
    return charge;
  }

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

/**
 * Called only after a server-side gateway verification succeeds. The caller
 * supplies the verified amount from Paystack/Flutterwave; this function still
 * checks the stored Payment amount and performs the balance mutation inside a
 * serializable transaction so duplicate callbacks cannot credit twice.
 */
export async function settleWalletFunding(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE",
  verifiedAmountNaira: number,
  rawPayload: object
): Promise<ActionResult<{ storeSlug: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { wallet: { include: { store: true, user: true } } } });
  if (!payment || payment.purpose !== "WALLET_FUNDING" || !payment.wallet) return { success: false, error: "Wallet payment not found." };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: payment.wallet.store.slug } };
  if (payment.status !== "PENDING") return { success: false, error: "Wallet payment is not pending." };
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) return { success: false, error: "Wallet funding amount mismatch." };

  const amount = Number(payment.amount);
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.storeWallet.findUnique({ where: { id: payment.wallet!.id } });
    if (!fresh || fresh.status !== "ACTIVE") throw new Error("WALLET_UNAVAILABLE");
    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
    });
    if (paymentUpdate.count === 0) return;
    const updatedWallet = await tx.storeWallet.update({ where: { id: fresh.id }, data: { balance: { increment: amount } } });
    await tx.walletTransaction.create({
      data: {
        walletId: fresh.id,
        type: "FUNDING",
        amount,
        balanceAfter: updatedWallet.balance,
        reference: `FUND-${payment.reference}`,
        paymentId: payment.id,
        note: `${provider} wallet funding`,
      },
    });
  }, { isolationLevel: "Serializable" });

  const email = payment.wallet.user.email;
  if (email) {
    void sendOrderNotificationEmail(email, `Wallet funded — ${payment.wallet.store.name}`, `Your BizNest wallet at <strong>${escapeHtml(payment.wallet.store.name)}</strong> was funded with <strong>₦${amount.toLocaleString()}</strong>.<br/><br/>Reference: <strong>${escapeHtml(reference)}</strong>.`);
  }
  revalidatePath(`/store/${payment.wallet.store.slug}/account/wallet`);
  return { success: true, data: { storeSlug: payment.wallet.store.slug } };
}


export async function startBookingPayment(
  storeSlug: string,
  bookingId: string,
  guestEmail?: string
): Promise<ActionResult<{ authorizationUrl: string }>> {
  const customerSession = await getStoreCustomerSessionForStore(storeSlug);
  const session = customerSession ?? await auth();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, store: { slug: storeSlug } },
    include: { service: true, store: true },
  });
  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.paymentStatus === "PAID") return { success: false, error: "This booking is already paid." };

  const authenticatedOwner = session?.user?.id && booking.buyerId === session.user.id;
  const guestOwner = !booking.buyerId && booking.guestEmail && guestEmail && booking.guestEmail.toLowerCase() === guestEmail.trim().toLowerCase();
  if (!authenticatedOwner && !guestOwner) return { success: false, error: "We couldn't verify this booking." };

  const amount = Number(booking.paymentAmount ?? booking.service.price);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "This service has an invalid price." };
  const reference = `BK-${booking.id}-${crypto.randomUUID()}`;
  const gateway = await import("@/lib/actions/site-settings").then((m) => m.getActiveGateway());
  const callbackUrl = gateway === "FLUTTERWAVE" ? `${APP_URL}/api/payments/flutterwave/callback` : `${APP_URL}/api/payments/paystack/callback`;
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "PENDING", paymentAmount: amount, paymentCurrency: booking.service.currency } }),
    prisma.payment.create({ data: { storeId: booking.storeId, bookingId: booking.id, purpose: "SERVICE_BOOKING", provider: gateway, reference, status: "PENDING", amount, currency: booking.service.currency } }),
  ]);

  const charge = await chargeCustomer({
    email: booking.guestEmail ?? customerSession?.user?.email ?? session?.user?.email ?? `booking-${booking.id}@biznest.space`,
    customerName: booking.guestName ?? customerSession?.user?.name ?? session?.user?.name ?? "BizNest customer",
    amountNaira: amount,
    reference,
    callbackUrl,
    gateway,
  });
  if (!charge.success) {
    await prisma.$transaction([
      prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } }),
      prisma.booking.updateMany({ where: { id: booking.id, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } }),
    ]);
    return charge;
  }

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

export async function settleServiceBookingPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE",
  verifiedAmountNaira: number,
  rawPayload: object
): Promise<ActionResult<{ storeSlug: string; bookingId: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { booking: { include: { service: true, store: true } } } });
  if (!payment || payment.purpose !== "SERVICE_BOOKING" || !payment.booking) return { success: false, error: "Booking payment not found." };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: payment.booking.store.slug, bookingId: payment.booking.id } };
  if (payment.status !== "PENDING") return { success: false, error: "Booking payment is not pending." };
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) return { success: false, error: "Payment amount mismatch." };

  await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (result.count === 0) return;
    await tx.booking.updateMany({ where: { id: payment.booking!.id, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID", paymentReference: reference, paymentAmount: payment.amount, paymentCurrency: payment.currency } });
  }, { isolationLevel: "Serializable" });

  const email = payment.booking.guestEmail;
  if (email) {
    void sendOrderNotificationEmail(email, `Booking paid — ${payment.booking.store.name}`, `Your booking for <strong>${escapeHtml(payment.booking.service.name)}</strong> at <strong>${escapeHtml(payment.booking.store.name)}</strong> has been paid successfully.<br/><br/>Booking reference: <strong>${escapeHtml(payment.booking.id)}</strong><br/>Amount paid: <strong>₦${Number(payment.amount).toLocaleString()}</strong><br/>Payment reference: <strong>${escapeHtml(reference)}</strong>`);
  } else if (payment.booking.buyerId) {
    const user = await prisma.user.findUnique({ where: { id: payment.booking.buyerId }, select: { email: true } });
    if (user?.email) void sendOrderNotificationEmail(user.email, `Booking paid — ${payment.booking.store.name}`, `Your booking for <strong>${escapeHtml(payment.booking.service.name)}</strong> at <strong>${escapeHtml(payment.booking.store.name)}</strong> has been paid successfully.<br/><br/>Booking reference: <strong>${escapeHtml(payment.booking.id)}</strong><br/>Amount paid: <strong>₦${Number(payment.amount).toLocaleString()}</strong>`);
  }
  revalidatePath(`/store/${payment.booking.store.slug}`);
  revalidatePath(`/store/${payment.booking.store.slug}/account/bookings`);
  return { success: true, data: { storeSlug: payment.booking.store.slug, bookingId: payment.booking.id } };
}

export async function payBookingWithWallet(
  storeSlug: string,
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  const customer = await getCustomer(storeSlug);
  if (!customer) return { success: false, error: "Please sign in to pay from your wallet." };

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, store: { slug: storeSlug }, buyerId: customer.userId },
    include: { service: true, store: true },
  });
  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.paymentStatus === "PAID") return { success: true, data: { bookingId } };

  const amount = Number(booking.paymentAmount ?? booking.service.price);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "This booking has no payable amount." };

  const reference = `WALPAY-${booking.id}`;
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.storeWallet.findUnique({ where: { storeId_userId: { storeId: booking.storeId, userId: customer.userId } } });
      if (!wallet || wallet.status !== "ACTIVE") throw new Error("WALLET_UNAVAILABLE");
      if (Number(wallet.balance) < amount) throw new Error("INSUFFICIENT_FUNDS");

      const existingPayment = await tx.payment.findUnique({ where: { reference } });
      if (existingPayment?.status === "SUCCESSFUL") return;

      const updatedWallet = await tx.storeWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
      const payment = existingPayment
        ? await tx.payment.update({ where: { id: existingPayment.id }, data: { status: "SUCCESSFUL", verifiedAt: new Date() } })
        : await tx.payment.create({ data: { storeId: booking.storeId, walletId: wallet.id, bookingId: booking.id, purpose: "SERVICE_BOOKING", provider: "WALLET", reference, status: "SUCCESSFUL", amount, currency: booking.paymentCurrency, verifiedAt: new Date() } });

      await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: "PAID", paymentReference: reference, paymentAmount: amount, paymentCurrency: booking.paymentCurrency } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: "PAYMENT", amount: -amount, balanceAfter: updatedWallet.balance, reference: `TXN-${reference}`, paymentId: payment.id, bookingId: booking.id, note: `Payment for ${booking.service.name}` } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_FUNDS") return { success: false, error: "Insufficient wallet balance. Fund your wallet and try again." };
    if (message === "WALLET_UNAVAILABLE") return { success: false, error: "Your wallet is currently unavailable." };
    throw error;
  }

  if (customer.email) {
    void sendOrderNotificationEmail(customer.email, `Booking paid — ${booking.store.name}`, `Your booking for <strong>${escapeHtml(booking.service.name)}</strong> at <strong>${escapeHtml(booking.store.name)}</strong> is paid from your BizNest wallet.<br/><br/>Booking reference: <strong>${escapeHtml(booking.id)}</strong><br/>Amount paid: <strong>₦${amount.toLocaleString()}</strong>`);
  }
  revalidatePath(`/store/${storeSlug}/account/wallet`);
  revalidatePath(`/store/${storeSlug}/account/bookings`);
  revalidatePath(`/store/${storeSlug}`);
  return { success: true, data: { bookingId } };
}

export async function createWalletPaymentRequest(storeSlug: string, bookingId: string): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const customer = await getCustomer(storeSlug);
  if (!customer) return { success: false, error: "Please sign in to generate a payment QR." };
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, store: { slug: storeSlug }, buyerId: customer.userId }, include: { service: true, store: true } });
  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.paymentStatus === "PAID") return { success: false, error: "This booking is already paid." };

  const wallet = await prisma.storeWallet.findUnique({ where: { storeId_userId: { storeId: booking.storeId, userId: customer.userId } } });
  if (!wallet || wallet.status !== "ACTIVE") return { success: false, error: "Create or fund your wallet before generating a payment QR." };
  const amount = Number(booking.paymentAmount ?? booking.service.price);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "This booking has no payable amount." };

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.walletPaymentRequest.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.walletPaymentRequest.create({ data: { storeId: booking.storeId, walletId: wallet.id, bookingId: booking.id, tokenHash, amount, currency: booking.paymentCurrency, expiresAt } });
  });
  return { success: true, data: { url: `${APP_URL}/store/${storeSlug}/wallet-pay/${token}`, expiresAt: expiresAt.toISOString() } };
}

export async function getWalletPaymentRequest(storeSlug: string, token: string) {
  const access = await (await import("@/lib/access/assert-store-access")).assertStorePermission(storeSlug, "orders");
  if (!access.success) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const request = await prisma.walletPaymentRequest.findUnique({ where: { tokenHash }, include: { booking: { include: { service: true } }, wallet: { include: { user: { select: { name: true, email: true } } } } } });
  if (!request || request.storeId !== access.store.id) return null;
  return request;
}

export async function redeemWalletPaymentRequest(storeSlug: string, token: string): Promise<ActionResult<{ bookingId: string }>> {
  const access = await (await import("@/lib/access/assert-store-access")).assertStorePermission(storeSlug, "orders");
  if (!access.success) return { success: false, error: access.error };
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const request = await prisma.walletPaymentRequest.findUnique({ where: { tokenHash }, include: { booking: { include: { service: true, store: true } }, wallet: true } });
  if (!request || request.storeId !== access.store.id) return { success: false, error: "Payment request not found." };
  if (request.status !== "PENDING") return { success: false, error: "This payment QR has already been used or cancelled." };
  if (request.expiresAt <= new Date()) {
    await prisma.walletPaymentRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    return { success: false, error: "This payment QR has expired. Ask the customer to generate a new one." };
  }

  const amount = Number(request.amount);
  const paymentReference = `WALPAY-${request.booking.id}`;
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.storeWallet.findUnique({ where: { id: request.walletId } });
      if (!wallet || wallet.status !== "ACTIVE") throw new Error("WALLET_UNAVAILABLE");
      if (Number(wallet.balance) < amount) throw new Error("INSUFFICIENT_FUNDS");
      const existing = await tx.payment.findUnique({ where: { reference: paymentReference } });
      if (existing?.status === "SUCCESSFUL") {
        await tx.walletPaymentRequest.update({ where: { id: request.id }, data: { status: "REDEEMED", redeemedAt: new Date() } });
        return;
      }
      const updatedWallet = await tx.storeWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
      const payment = existing
        ? await tx.payment.update({ where: { id: existing.id }, data: { status: "SUCCESSFUL", verifiedAt: new Date(), walletId: wallet.id, bookingId: request.booking.id } })
        : await tx.payment.create({ data: { storeId: request.storeId, walletId: wallet.id, bookingId: request.booking.id, purpose: "SERVICE_BOOKING", provider: "WALLET", reference: paymentReference, status: "SUCCESSFUL", amount, currency: request.currency, verifiedAt: new Date() } });
      await tx.booking.update({ where: { id: request.booking.id }, data: { paymentStatus: "PAID", paymentReference: paymentReference, paymentAmount: amount, paymentCurrency: request.currency } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: "PAYMENT", amount: -amount, balanceAfter: updatedWallet.balance, reference: `TXN-${paymentReference}`, paymentId: payment.id, bookingId: request.booking.id, note: `QR wallet payment for ${request.booking.service.name}` } });
      await tx.walletPaymentRequest.update({ where: { id: request.id }, data: { status: "REDEEMED", redeemedAt: new Date() } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_FUNDS") return { success: false, error: "The customer's wallet does not have enough balance." };
    if (message === "WALLET_UNAVAILABLE") return { success: false, error: "The customer's wallet is unavailable." };
    throw error;
  }

  const email = request.booking.guestEmail;
  if (email) void sendOrderNotificationEmail(email, `Booking paid — ${request.booking.store.name}`, `Your booking for <strong>${escapeHtml(request.booking.service.name)}</strong> at <strong>${escapeHtml(request.booking.store.name)}</strong> has been paid from your BizNest wallet.<br/><br/>Amount: <strong>₦${amount.toLocaleString()}</strong><br/>Payment reference: <strong>${escapeHtml(paymentReference)}</strong>`);
  else if (request.wallet.user.email) void sendOrderNotificationEmail(request.wallet.user.email, `Booking paid — ${request.booking.store.name}`, `Your booking for <strong>${escapeHtml(request.booking.service.name)}</strong> at <strong>${escapeHtml(request.booking.store.name)}</strong> has been paid from your BizNest wallet.<br/><br/>Amount: <strong>₦${amount.toLocaleString()}</strong>`);

  revalidatePath(`/store/${storeSlug}/account/bookings`);
  revalidatePath(`/store/${storeSlug}/account/wallet`);
  revalidatePath(`/store/${storeSlug}/wallet-pay/${token}`);
  return { success: true, data: { bookingId: request.booking.id } };
}
