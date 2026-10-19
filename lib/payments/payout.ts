import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPaystackTransferRecipient,
  getPaystackBalanceKobo,
  initiatePaystackTransfer,
  verifyPaystackTransfer,
  type PaystackTransferStatus,
} from "@/lib/payments/paystack";
import { logError, logInfo } from "@/lib/observability/log";

/**
 * Vendor payouts.
 *
 * Customers pay the platform's gateway account; as soon as a payment is
 * verified we queue ONE Payout for it (Payout.paymentId is unique, so a
 * webhook + callback race can never create two) and push the store's money to
 * its bank account with the Paystack Transfer API. Stores receive the full
 * amount the customer paid minus Order.commission, which is 0 (BizNest earns
 * from subscription plans, not from sales -- see lib/constants/commission.ts).
 *
 * Safety properties:
 *  - The transfer reference is derived from the payout id, never random, so a
 *    retry can't pay a store twice: Paystack rejects a reference it has seen.
 *  - Before re-sending after any earlier attempt we ask Paystack whether that
 *    reference already exists (an attempt can succeed even if our request
 *    timed out).
 *  - Missing platform balance, a store with no bank account yet, and network
 *    errors leave the payout QUEUED and retried later; they never lose it.
 *  - A transfer Paystack reports as failed is terminal for that reference. It
 *    is marked FAILED and logged for a human, because re-sending under a new
 *    reference could double pay.
 *
 * Only payments made through a gateway are paid out. Payments that already
 * carry a split subaccount (legacy stores) were settled to the vendor by
 * Paystack itself and are skipped.
 */

const PAYOUT_PURPOSES = ["ORDER", "SERVICE_BOOKING", "PMS_RESERVATION", "INVOICE", "QUOTE_DEPOSIT"] as const;
const MAX_ATTEMPTS = 8;
const BALANCE_RETRY_MS = 15 * 60_000;
const NO_ACCOUNT_RETRY_MS = 60 * 60_000;
const STALE_PROCESSING_MS = 10 * 60_000;

export function payoutReference(payoutId: string): string {
  // Paystack: 16-50 chars, lowercase letters, digits, "-" and "_".
  return `bnp-${payoutId.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
}

/** 15 min, 30, 60, ... capped at 6 h. */
export function retryDelayMs(attempts: number): number {
  return Math.min(6 * 60 * 60_000, 15 * 60_000 * 2 ** Math.max(0, attempts - 1));
}

export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

type Outcome = "PAID" | "PROCESSING" | "FAILED" | "REVERSED" | "OTP";

export function classifyTransferStatus(status: PaystackTransferStatus | string | undefined): Outcome {
  switch (status) {
    case "success":
      return "PAID";
    case "failed":
      return "FAILED";
    case "reversed":
      return "REVERSED";
    case "otp":
      return "OTP";
    default:
      return "PROCESSING"; // pending / received / queued: the webhook finalises it
  }
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* QUEUE                                                                       */
/* -------------------------------------------------------------------------- */

export async function queuePayoutForPayment(reference: string): Promise<{ payoutId?: string; skipped?: string }> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: {
      order: { select: { commission: true } },
      store: { select: { id: true, payoutBankCode: true, payoutAccountNumber: true, payoutDetails: true } },
    },
  });

  if (!payment) return { skipped: "payment not found" };
  if (payment.status !== "SUCCESSFUL") return { skipped: "payment not successful" };
  if (!payment.storeId || !payment.store) return { skipped: "payment has no store" };
  if (!(PAYOUT_PURPOSES as readonly string[]).includes(payment.purpose)) return { skipped: "not a vendor payment" };
  if (payment.splitSubaccountCode) return { skipped: "already split to the vendor by the gateway" };

  const amount = roundMoney(Number(payment.amount) - Number(payment.order?.commission ?? 0));
  if (amount <= 0) return { skipped: "nothing to pay out" };

  const hasAccount = Boolean(payment.store.payoutBankCode && payment.store.payoutAccountNumber);
  const details = (payment.store.payoutDetails ?? null) as { bankName?: string; accountName?: string; maskedAccountNumber?: string } | null;

  // Flutterwave collections sit in the Flutterwave balance; we only automate Paystack transfers.
  const unsupported = payment.provider !== "PAYSTACK";

  // Id is generated up front so the transfer reference can be derived from it in the same insert.
  const payoutId = randomUUID().replace(/-/g, "");
  try {
    await prisma.payout.create({
      data: {
        id: payoutId,
        storeId: payment.storeId,
        paymentId: payment.id,
        provider: payment.provider,
        amount,
        currency: payment.currency,
        reference: payoutReference(payoutId),
        status: unsupported ? "FAILED" : "QUEUED",
        lastError: unsupported
          ? "Payouts for this gateway are not automated yet. Pay this store manually."
          : hasAccount
            ? null
            : "Store has not connected a bank account yet.",
        nextAttemptAt: unsupported ? null : hasAccount ? null : new Date(Date.now() + NO_ACCOUNT_RETRY_MS),
        destination: (details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    if (unsupported) {
      void logError("PAYMENTS", "Payout needs manual handling (gateway not automated)", { paymentId: payment.id, provider: payment.provider });
    }
    return { payoutId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.payout.findUnique({ where: { paymentId: payment.id }, select: { id: true } });
      return { payoutId: existing?.id, skipped: "payout already exists" };
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* SEND                                                                        */
/* -------------------------------------------------------------------------- */

type Applied = { state: Outcome; message?: string };

async function applyTransferResult(
  payoutId: string,
  data: { transfer_code?: string; status?: PaystackTransferStatus | string },
  raw: object
): Promise<Applied> {
  const state = classifyTransferStatus(data.status);
  const base = { gatewayTransferId: data.transfer_code ?? undefined, rawPayload: raw as Prisma.InputJsonValue };

  if (state === "PAID") {
    await prisma.payout.update({ where: { id: payoutId }, data: { ...base, status: "PAID", paidAt: new Date(), lastError: null } });
  } else if (state === "PROCESSING") {
    await prisma.payout.update({ where: { id: payoutId }, data: { ...base, status: "PROCESSING", lastError: null } });
  } else if (state === "OTP") {
    const message = 'Paystack is asking for an OTP. Turn off "Confirm transfers before sending" in Paystack settings so payouts can run automatically.';
    await prisma.payout.update({ where: { id: payoutId }, data: { ...base, status: "FAILED", lastError: message } });
    void logError("PAYMENTS", "Payout blocked: Paystack transfer OTP is enabled", { payoutId });
    return { state, message };
  } else {
    const message = state === "REVERSED" ? "Transfer was reversed by the gateway." : "Transfer failed at the gateway.";
    await prisma.payout.update({ where: { id: payoutId }, data: { ...base, status: state, lastError: message } });
    void logError("PAYMENTS", `Payout ${state.toLowerCase()}`, { payoutId });
    return { state, message };
  }
  return { state };
}

async function requeue(payoutId: string, delayMs: number, message: string, opts?: { refundAttempt?: boolean }) {
  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: "QUEUED",
      lastError: message,
      nextAttemptAt: new Date(Date.now() + delayMs),
      ...(opts?.refundAttempt ? { attempts: { decrement: 1 } } : {}),
    },
  });
}

/**
 * Sends one payout. Safe to call concurrently and repeatedly: the claim step
 * lets exactly one caller through per attempt.
 */
export async function processPayout(
  payoutId: string,
  ctx: { balanceKobo?: number | null } = {}
): Promise<{ state: Outcome | "QUEUED" | "SKIPPED"; message?: string; spentKobo?: number }> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { store: { select: { id: true, name: true, payoutBankCode: true, payoutAccountNumber: true, paystackRecipientCode: true, payoutDetails: true } } },
  });
  if (!payout) return { state: "SKIPPED", message: "not found" };

  // Sweep path: a transfer was sent but we never heard the outcome.
  if (payout.status === "PROCESSING") {
    if (Date.now() - payout.updatedAt.getTime() < STALE_PROCESSING_MS) return { state: "SKIPPED", message: "in flight" };
    const check = await verifyPaystackTransfer(payout.reference);
    if (check.status && check.data) return applyTransferResult(payout.id, check.data, check);
    // Paystack has no such transfer, so nothing was sent: safe to try again.
    await requeue(payout.id, 0, "Previous attempt never reached the gateway.");
    return { state: "QUEUED" };
  }

  if (payout.status !== "QUEUED") return { state: "SKIPPED", message: `status ${payout.status}` };
  if (payout.nextAttemptAt && payout.nextAttemptAt.getTime() > Date.now()) return { state: "SKIPPED", message: "not due yet" };

  // Atomically claim this attempt.
  const claimed = await prisma.payout.updateMany({
    where: { id: payout.id, status: "QUEUED", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { state: "SKIPPED", message: "claimed elsewhere" };

  try {
    // An earlier attempt may have reached Paystack even though we never saw the answer.
    if (payout.attempts > 0) {
      const existing = await verifyPaystackTransfer(payout.reference);
      if (existing.status && existing.data) return await applyTransferResult(payout.id, existing.data, existing);
    }

    const store = payout.store;
    if (!store.payoutBankCode || !store.payoutAccountNumber) {
      await requeue(payout.id, NO_ACCOUNT_RETRY_MS, "Store has not connected a bank account yet.", { refundAttempt: true });
      return { state: "QUEUED", message: "no bank account" };
    }

    let recipientCode = store.paystackRecipientCode;
    if (!recipientCode) {
      const details = (store.payoutDetails ?? null) as { accountName?: string } | null;
      const created = await createPaystackTransferRecipient({
        name: details?.accountName ?? store.name,
        accountNumber: store.payoutAccountNumber,
        bankCode: store.payoutBankCode,
        description: `BizNest vendor payout for ${store.name}`,
      });
      if (!created.status || !created.data) {
        const message = created.message || "Couldn't register the store's bank account with Paystack.";
        await requeue(payout.id, retryDelayMs(payout.attempts + 1), message);
        void logError("PAYMENTS", "Payout recipient registration failed", { payoutId: payout.id, message });
        return { state: "QUEUED", message };
      }
      recipientCode = created.data.recipient_code;
      await prisma.store.update({ where: { id: store.id }, data: { paystackRecipientCode: recipientCode } });
    }

    const amountKobo = toKobo(Number(payout.amount));
    const balanceKobo = ctx.balanceKobo !== undefined ? ctx.balanceKobo : (await getPaystackBalanceKobo()).balanceKobo ?? null;
    if (balanceKobo !== null && balanceKobo !== undefined && balanceKobo < amountKobo) {
      await requeue(payout.id, BALANCE_RETRY_MS, "Waiting for the payment to settle into the platform's Paystack balance.", { refundAttempt: true });
      return { state: "QUEUED", message: "insufficient balance" };
    }

    const sent = await initiatePaystackTransfer({
      amountKobo,
      recipientCode,
      reference: payout.reference,
      reason: `BizNest payout for ${store.name}`,
    });

    if (!sent.status || !sent.data) {
      const message = sent.message || "Transfer was not accepted.";
      if (/balance/i.test(message)) {
        await requeue(payout.id, BALANCE_RETRY_MS, message, { refundAttempt: true });
        return { state: "QUEUED", message };
      }
      if (payout.attempts + 1 >= MAX_ATTEMPTS) {
        await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", lastError: message } });
        void logError("PAYMENTS", "Payout failed after maximum attempts", { payoutId: payout.id, message });
        return { state: "FAILED", message };
      }
      await requeue(payout.id, retryDelayMs(payout.attempts + 1), message);
      return { state: "QUEUED", message };
    }

    const applied = await applyTransferResult(payout.id, sent.data, sent);
    return { ...applied, spentKobo: applied.state === "PAID" || applied.state === "PROCESSING" ? amountKobo : 0 };
  } catch (err) {
    // Network error etc.: the transfer may or may not exist. The next attempt
    // verifies the reference first, so retrying cannot double pay.
    const message = err instanceof Error ? err.message : "Unexpected payout error";
    await requeue(payout.id, retryDelayMs(payout.attempts + 1), message);
    void logError("PAYMENTS", "Payout attempt threw", { payoutId: payout.id, message });
    return { state: "QUEUED", message };
  }
}

/* -------------------------------------------------------------------------- */
/* ENTRY POINTS                                                                */
/* -------------------------------------------------------------------------- */

/** Called from every settlement path right after a gateway payment is marked SUCCESSFUL. Never throws. */
export async function settleAndPayout(paymentReference: string): Promise<void> {
  try {
    const queued = await queuePayoutForPayment(paymentReference);
    if (!queued.payoutId || queued.skipped === "payout already exists") return;
    await processPayout(queued.payoutId);
  } catch (err) {
    void logError("PAYMENTS", "settleAndPayout failed", { paymentReference, message: err instanceof Error ? err.message : String(err) });
  }
}

/** Cron safety net: retries queued payouts and settles transfers whose webhook never arrived. */
export async function processDuePayouts(limit = 25): Promise<{ checked: number; paid: number; processing: number; queued: number; failed: number }> {
  const now = new Date();
  const stale = await prisma.payout.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const due = await prisma.payout.findMany({
    where: { status: "QUEUED", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const summary = { checked: stale.length + due.length, paid: 0, processing: 0, queued: 0, failed: 0 };
  if (summary.checked === 0) return summary;

  let balanceKobo: number | null | undefined = (await getPaystackBalanceKobo()).balanceKobo ?? null;

  for (const { id } of [...stale, ...due]) {
    const result = await processPayout(id, { balanceKobo });
    if (result.spentKobo && balanceKobo !== null && balanceKobo !== undefined) balanceKobo -= result.spentKobo;
    if (result.state === "PAID") summary.paid++;
    else if (result.state === "PROCESSING") summary.processing++;
    else if (result.state === "QUEUED") summary.queued++;
    else if (result.state === "FAILED" || result.state === "REVERSED" || result.state === "OTP") summary.failed++;
  }

  void logInfo("JOBS", "Payout sweep complete", summary);
  return summary;
}
