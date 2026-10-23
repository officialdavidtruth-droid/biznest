"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { prisma } from "@/lib/prisma";
import { chargeCustomer } from "@/lib/payments/gateway";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { confirmPaidBooking } from "@/lib/payments/booking-confirmation";
import { settleAndPayout } from "@/lib/payments/payout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

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
): Promise<ActionResult<{ authorizationUrl: string; amount: number; inline?: { provider: "PAYSTACK" | "FLUTTERWAVE"; publicKey: string; email: string; accessCode?: string; reference: string; subaccountCode?: string | null; subaccountId?: string | null; amountNaira?: number } }>> {
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
    inline: true,
  });
  if (!charge.success) {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
    return charge;
  }

  return { success: true, data: { authorizationUrl: charge.authorizationUrl, amount, inline: charge.inline } };
}

export async function startBookingPayment(
  storeSlug: string,
  bookingId: string,
  guestEmail?: string,
  // Templates that redirect to authorizationUrl (rather than opening the
  // gateway's inline modal) pass { inline: false } so Flutterwave returns a
  // real hosted-checkout link instead of the bare callback URL.
  options: { inline?: boolean } = {}
): Promise<ActionResult<{ authorizationUrl: string; amount: number; inline?: { provider: "PAYSTACK" | "FLUTTERWAVE"; publicKey: string; email: string; accessCode?: string; reference: string; subaccountCode?: string | null; subaccountId?: string | null; amountNaira?: number } }>> {
  const customerSession = await getStoreCustomerSessionForStore(storeSlug);
  const session = customerSession ?? await auth();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, store: { slug: storeSlug } },
    include: { service: true, store: true },
  });
  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.status === "CANCELLED") return { success: false, error: "This booking has been cancelled." };
  if (booking.paymentStatus === "PAID") return { success: false, error: "This booking is already paid." };
  // Storefront bookings are intentionally held for 30 minutes while the
  // customer completes checkout. Expired online holds must not be revived by
  // a late retry link; admin/front-desk bookings are unaffected.
  if (
    booking.source === "Online" &&
    booking.status === "PENDING" &&
    booking.createdAt < new Date(Date.now() - 30 * 60 * 1000)
  ) {
    return { success: false, error: "This booking hold has expired. Please make a new booking." };
  }

  const authenticatedOwner = session?.user?.id && booking.buyerId === session.user.id;
  const guestOwner = !booking.buyerId && booking.guestEmail && guestEmail && booking.guestEmail.toLowerCase() === guestEmail.trim().toLowerCase();
  if (!authenticatedOwner && !guestOwner) return { success: false, error: "We couldn't verify this booking." };

  const amount = Number(booking.paymentAmount ?? booking.service.price);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "This service has an invalid price." };
  const reference = `BK-${booking.id}-${crypto.randomUUID()}`;
  const { resolveCheckoutGateway, paymentCallbackUrl } = await import("@/lib/payments/gateway");
  // The store's own gateway (bring-your-own keys) wins over the platform's active gateway.
  const checkoutGateway = await resolveCheckoutGateway(booking.storeId);
  if (!checkoutGateway.ok) return { success: false, error: checkoutGateway.error };
  const gateway = checkoutGateway.gateway;
  const callbackUrl = paymentCallbackUrl(gateway);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "PENDING", paymentAmount: amount, paymentCurrency: booking.service.currency } }),
    prisma.payment.create({ data: { storeId: booking.storeId, bookingId: booking.id, purpose: "SERVICE_BOOKING", provider: gateway, reference, status: "PENDING", amount, currency: booking.service.currency, usesStoreGateway: checkoutGateway.usesStoreGateway } }),
  ]);

  const charge = await chargeCustomer({
    email: booking.guestEmail ?? customerSession?.user?.email ?? session?.user?.email ?? `booking-${booking.id}@biznest.space`,
    customerName: booking.guestName ?? customerSession?.user?.name ?? session?.user?.name ?? "BizNest customer",
    amountNaira: amount,
    reference,
    callbackUrl,
    gateway,
    storeId: booking.storeId,
    inline: options.inline ?? true,
  });
  if (!charge.success) {
    await prisma.$transaction([
      prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } }),
      prisma.booking.updateMany({ where: { id: booking.id, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } }),
    ]);
    return charge;
  }

  return { success: true, data: { authorizationUrl: charge.authorizationUrl, amount, inline: charge.inline } };
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
  if (booking.status === "CANCELLED") return { success: false, error: "This booking has been cancelled." };
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

  // The customer's money is already in the platform account; pay the store out of it.
  await settleAndPayout(reference);
  void confirmPaidBooking(booking.id, reference, amount);
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
  const request = await prisma.walletPaymentRequest.findUnique({ where: { tokenHash }, include: { booking: { include: { service: true, store: true } }, wallet: { include: { user: { select: { name: true, email: true } } } } } });
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

  await settleAndPayout(paymentReference);
  void confirmPaidBooking(request.booking.id, paymentReference, amount);

  revalidatePath(`/store/${storeSlug}/account/bookings`);
  revalidatePath(`/store/${storeSlug}/account/wallet`);
  revalidatePath(`/store/${storeSlug}/wallet-pay/${token}`);
  return { success: true, data: { bookingId: request.booking.id } };
}
