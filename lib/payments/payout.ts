import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PaystackTransferStatus } from "@/lib/payments/paystack";
import { resolveBankCodeForGateway } from "@/lib/payments/bank-codes";
import {
  createPaystackTransferRecipient,
  gatewayForPayout,
  getGatewayBalanceKobo,
  lookupGatewayTransfer,
  sendGatewayTransfer,
  type TransferGateway,
} from "@/lib/payments/payout-gateway";
import { logError, logInfo } from "@/lib/observability/log";

/**
 * Vendor payouts.
 *
 * Customers pay the platform's gateway account; as soon as a payment is
 * verified we queue ONE Payout for it (Payout.paymentId is unique, so a
 * webhook + callback race can never create two) and push the store's money to
 * its bank account with the paying gateway's Transfer API (Paystack or
 * Flutterwave, see payout-gateway.ts). Stores receive the full
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
 * the gateway itself and are skipped. New charges are never split.
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
  // Paystack reports lowercase ("success"), Flutterwave uppercase ("SUCCESSFUL").
  switch (typeof status === "string" ? status.toLowerCase() : status) {
    case "success":
    case "successful":
      return "PAID";
    case "failed":
      return "FAILED";
    case "reversed":
      return "REVERSED";
    case "otp":
      return "OTP";
    default:
      return "PROCESSING"; // pending / received / queued / new: the webhook finalises it
  }
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Wallet payouts follow the platform's active gateway. Falls back to Paystack if the setting can't be read. */
async function activeTransferGateway(): Promise<TransferGateway> {
  try {
    const { getActiveGateway } = await import("@/lib/actions/site-settings");
    return (await getActiveGateway()) === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
  } catch {
    return "PAYSTACK";
  }
}

const gatewayLabel = (g: TransferGateway) => (g === "FLUTTERWAVE" ? "Flutterwave" : "Paystack");

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
  // Collected with the store's own gateway keys: the money is already in the
  // merchant's own gateway account, so there is nothing for BizNest to pay out.
  if (payment.usesStoreGateway) return { skipped: "paid directly to the store's own gateway account" };
  if (payment.status !== "SUCCESSFUL") return { skipped: "payment not successful" };
  if (!payment.storeId || !payment.store) return { skipped: "payment has no store" };
  if (!(PAYOUT_PURPOSES as readonly string[]).includes(payment.purpose)) return { skipped: "not a vendor payment" };
  if (payment.splitSubaccountCode) return { skipped: "already split to the vendor by the gateway" };
  if (payment.provider === "CASH") return { skipped: "settled outside the platform" };

  const amount = roundMoney(Number(payment.amount) - Number(payment.order?.commission ?? 0));
  if (amount <= 0) return { skipped: "nothing to pay out" };

  const hasAccount = Boolean(payment.store.payoutBankCode && payment.store.payoutAccountNumber);
  const details = (payment.store.payoutDetails ?? null) as { bankName?: string; accountName?: string; maskedAccountNumber?: string } | null;

  // Paystack and Flutterwave collections are paid out from that same gateway's balance.
  // Wallet payments have no single source gateway: the customer's money reached the platform
  // when they funded the wallet, so the vendor is paid from whichever gateway is active now
  // (if that balance is short the payout simply stays QUEUED and retries until the money is there).
  const unsupported = payment.provider !== "PAYSTACK" && payment.provider !== "FLUTTERWAVE" && payment.provider !== "WALLET";
  const transferGateway: TransferGateway =
    payment.provider === "FLUTTERWAVE" ? "FLUTTERWAVE" : payment.provider === "WALLET" ? await activeTransferGateway() : "PAYSTACK";

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
          ? "Payouts for this payment method are not automated. Pay this store manually."
          : hasAccount
            ? null
            : "Store has not connected a bank account yet.",
        nextAttemptAt: unsupported ? null : hasAccount ? null : new Date(Date.now() + NO_ACCOUNT_RETRY_MS),
        // transferGateway is pinned here so retries and lookups always hit the same gateway.
        destination: { ...(details ?? {}), transferGateway } as Prisma.InputJsonValue,
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
    include: {
      store: { select: { id: true, name: true, payoutBankCode: true, payoutAccountNumber: true, paystackRecipientCode: true, payoutDetails: true } },
      payment: { select: { status: true } },
    },
  });
  if (!payout) return { state: "SKIPPED", message: "not found" };

  // Never send money for a charge that was refunded after the payout was queued.
  if (payout.status === "QUEUED" && payout.payment && payout.payment.status !== "SUCCESSFUL") {
    const message = `Payment is ${payout.payment.status.toLowerCase()}; payout not sent.`;
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", lastError: message, nextAttemptAt: null } });
    void logError("PAYMENTS", "Payout cancelled: payment no longer successful", { payoutId: payout.id, paymentStatus: payout.payment.status });
    return { state: "FAILED", message };
  }

  // Sweep path: a transfer was sent but we never heard the outcome.
  if (payout.status === "PROCESSING") {
    if (Date.now() - payout.updatedAt.getTime() < STALE_PROCESSING_MS) return { state: "SKIPPED", message: "in flight" };
    const gateway = gatewayForPayout(payout.provider, payout.destination);
    const check = await lookupGatewayTransfer(gateway, payout.reference);
    if (check.found) return applyTransferResult(payout.id, check.data, check.raw);
    // Only a positive "no such transfer" makes re-sending safe. An API error leaves it
    // PROCESSING so the next sweep asks again instead of risking a double payment.
    if (!check.notFound) return { state: "SKIPPED", message: `couldn't confirm with ${gatewayLabel(gateway)}: ${check.message || "no response"}` };
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
    const gateway = gatewayForPayout(payout.provider, payout.destination);
    const label = gatewayLabel(gateway);

    // An earlier attempt may have reached the gateway even though we never saw the answer.
    if (payout.attempts > 0) {
      const existing = await lookupGatewayTransfer(gateway, payout.reference);
      if (existing.found) return await applyTransferResult(payout.id, existing.data, existing.raw);
    }

    const store = payout.store;
    if (!store.payoutBankCode || !store.payoutAccountNumber) {
      await requeue(payout.id, NO_ACCOUNT_RETRY_MS, "Store has not connected a bank account yet.", { refundAttempt: true });
      return { state: "QUEUED", message: "no bank account" };
    }
    const details = (store.payoutDetails ?? null) as { accountName?: string } | null;

    // Bank codes differ between gateways for some banks (Opay, Palmpay): use the one this gateway accepts.
    const bank = await resolveBankCodeForGateway(store, gateway);
    if ("error" in bank) {
      await requeue(payout.id, NO_ACCOUNT_RETRY_MS, bank.error, { refundAttempt: true });
      void logError("PAYMENTS", "Payout waiting on bank code", { payoutId: payout.id, message: bank.error });
      return { state: "QUEUED", message: bank.error };
    }

    // Paystack sends to a registered recipient; Flutterwave takes the bank details directly.
    let recipientCode = store.paystackRecipientCode ?? undefined;
    if (gateway === "PAYSTACK" && !recipientCode) {
      const created = await createPaystackTransferRecipient({
        name: details?.accountName ?? store.name,
        accountNumber: store.payoutAccountNumber,
        bankCode: bank.code,
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
    const balanceKobo = ctx.balanceKobo !== undefined ? ctx.balanceKobo : await getGatewayBalanceKobo(gateway);
    if (balanceKobo !== null && balanceKobo !== undefined && balanceKobo < amountKobo) {
      await requeue(payout.id, BALANCE_RETRY_MS, `Waiting for the payment to settle into the platform's ${label} balance.`, { refundAttempt: true });
      return { state: "QUEUED", message: "insufficient balance" };
    }

    const sent = await sendGatewayTransfer(gateway, {
      amountKobo,
      reference: payout.reference,
      narration: `BizNest payout for ${store.name}`,
      bankCode: bank.code,
      accountNumber: store.payoutAccountNumber,
      beneficiaryName: details?.accountName,
      recipientCode,
    });

    if (!sent.ok) {
      const message = sent.message;
      if (/balance|insufficient/i.test(message)) {
        await requeue(payout.id, BALANCE_RETRY_MS, message, { refundAttempt: true });
        return { state: "QUEUED", message };
      }
      // The gateway says it has seen this reference: an earlier attempt got through. Record
      // that transfer's real state instead of failing or re-sending.
      if (gateway === "FLUTTERWAVE" && /duplicate|already|reference/i.test(message)) {
        const existing = await lookupGatewayTransfer(gateway, payout.reference);
        if (existing.found) return await applyTransferResult(payout.id, existing.data, existing.raw);
      }
      // Flutterwave only lets whitelisted server IPs call the Transfer API in live mode.
      if (gateway === "FLUTTERWAVE" && /whitelist|ip address/i.test(message)) {
        await requeue(payout.id, BALANCE_RETRY_MS, message, { refundAttempt: true });
        void logError("PAYMENTS", "Flutterwave rejected the transfer: server IP is not whitelisted", { payoutId: payout.id, message });
        return { state: "QUEUED", message };
      }
      // A cached Paystack recipient code is only valid under the key mode that
      // created it. After a test<->live switch (or a deleted recipient) Paystack
      // rejects it: drop it so the next attempt registers a fresh one.
      if (gateway === "PAYSTACK" && /recipient/i.test(message)) {
        await prisma.store.update({ where: { id: store.id }, data: { paystackRecipientCode: null } });
        await requeue(payout.id, 0, message, { refundAttempt: true });
        void logError("PAYMENTS", "Paystack rejected cached transfer recipient; cleared for re-registration", { payoutId: payout.id, message });
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

    const applied = await applyTransferResult(payout.id, sent.data, sent.raw);
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
    select: { id: true, provider: true, destination: true },
  });
  const due = await prisma.payout.findMany({
    where: { status: "QUEUED", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, provider: true, destination: true },
  });

  const summary = { checked: stale.length + due.length, paid: 0, processing: 0, queued: 0, failed: 0 };
  if (summary.checked === 0) return summary;

  // One balance read per gateway per sweep, decremented locally as transfers go out.
  const balances: Partial<Record<TransferGateway, number | null>> = {};

  for (const { id, provider, destination } of [...stale, ...due]) {
    const gateway = gatewayForPayout(provider, destination);
    if (!(gateway in balances)) balances[gateway] = await getGatewayBalanceKobo(gateway).catch(() => null);
    const balanceKobo = balances[gateway] ?? null;
    const result = await processPayout(id, { balanceKobo });
    if (result.spentKobo && balanceKobo !== null) balances[gateway] = balanceKobo - result.spentKobo;
    if (result.state === "PAID") summary.paid++;
    else if (result.state === "PROCESSING") summary.processing++;
    else if (result.state === "QUEUED") summary.queued++;
    else if (result.state === "FAILED" || result.state === "REVERSED" || result.state === "OTP") summary.failed++;
  }

  void logInfo("JOBS", "Payout sweep complete", summary);
  return summary;
}


/* -------------------------------------------------------------------------- */
/* ADMIN RECOVERY                                                              */
/* -------------------------------------------------------------------------- */

const RETRYABLE_PROVIDERS = ["PAYSTACK", "FLUTTERWAVE", "WALLET"];

/**
 * Admin "Retry" for a FAILED / REVERSED payout. Never double pays: it first asks
 * the gateway about the existing reference. Only when it confirms that transfer
 * failed/reversed, or has no record of it, does it issue a fresh reference and
 * requeue. A transfer that actually went through (or is still in flight) is
 * recorded as such instead.
 */
export async function retryPayout(payoutId: string): Promise<{ ok: boolean; message: string }> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId }, select: { id: true, status: true, provider: true, reference: true, destination: true } });
  if (!payout) return { ok: false, message: "Payout not found." };
  if (payout.status !== "FAILED" && payout.status !== "REVERSED") return { ok: false, message: `Only failed or reversed payouts can be retried (this one is ${payout.status.toLowerCase()}).` };
  if (!RETRYABLE_PROVIDERS.includes(payout.provider)) return { ok: false, message: "This payment method's payouts aren't automated. Pay the store manually, then use \"Mark paid\"." };

  const gateway = gatewayForPayout(payout.provider, payout.destination);
  const label = gatewayLabel(gateway);
  const check = await lookupGatewayTransfer(gateway, payout.reference);
  if (check.found) {
    const state = classifyTransferStatus(check.data.status);
    if (state !== "FAILED" && state !== "REVERSED") {
      await applyTransferResult(payout.id, check.data, check.raw);
      return { ok: false, message: state === "PAID" ? `${label} shows this transfer already went through. Marked as paid.` : `${label} still has this transfer in flight; its status was refreshed.` };
    }
  } else if (!check.notFound) {
    return { ok: false, message: `Couldn't confirm the old transfer with ${label} (${check.message || "no response"}). Try again shortly.` };
  }

  // Confirmed not paid. A new reference is required: the gateway remembers the old one.
  const reference = `${payoutReference(payout.id)}-r${Date.now().toString(36)}`;
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: "QUEUED", reference, attempts: 0, lastError: null, nextAttemptAt: null, gatewayTransferId: null },
  });
  const result = await processPayout(payout.id);
  return { ok: true, message: result.state === "PAID" || result.state === "PROCESSING" ? "Transfer sent." : `Requeued${result.message ? `: ${result.message}` : "."}` };
}

/** Admin "Mark paid": the money was sent outside the platform. Records who/why in rawPayload. */
export async function markPayoutPaidManually(payoutId: string, note: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, message: "A note is required (e.g. the bank transfer reference)." };
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ["FAILED", "REVERSED", "QUEUED"] } },
    data: { status: "PAID", paidAt: new Date(), lastError: null, nextAttemptAt: null, rawPayload: { manual: true, note: trimmed, at: new Date().toISOString() } as Prisma.InputJsonValue },
  });
  if (updated.count === 0) return { ok: false, message: "This payout can't be marked paid (already paid, processing, or not found)." };
  return { ok: true, message: "Marked as paid." };
}

/**
 * One-off catch-up for wallet payments made before wallet bookings triggered a
 * payout. Finds successful, unrefunded wallet booking payments with no Payout
 * row and (unless dryRun) queues + sends them. Idempotent: Payout.paymentId is unique.
 */
export async function backfillWalletPayouts(opts: { dryRun?: boolean; limit?: number } = {}): Promise<{ found: number; totalNaira: number; queued: number }> {
  const dryRun = opts.dryRun ?? true;
  const payments = await prisma.payment.findMany({
    where: { provider: "WALLET", purpose: "SERVICE_BOOKING", status: "SUCCESSFUL", payout: { is: null }, storeId: { not: null } },
    select: { reference: true, amount: true },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 100,
  });
  const totalNaira = roundMoney(payments.reduce((sum, p) => sum + Number(p.amount), 0));
  if (dryRun) return { found: payments.length, totalNaira, queued: 0 };

  let queued = 0;
  for (const p of payments) {
    await settleAndPayout(p.reference);
    queued++;
  }
  return { found: payments.length, totalNaira, queued };
}


/* -------------------------------------------------------------------------- */
/* WEBHOOK                                                                     */
/* -------------------------------------------------------------------------- */

type TransferEvent = "transfer.success" | "transfer.failed" | "transfer.reversed";

// Which current statuses each Paystack event may move a payout out of.
// A late "failed" must never undo a payout that already went through (a
// reversal after PAID is real, so that one is allowed), and a repeated
// "success" must not overwrite paidAt.
const TRANSFER_EVENT_RULES: Record<TransferEvent, { status: "PAID" | "FAILED" | "REVERSED"; from: Array<"QUEUED" | "PROCESSING" | "PAID" | "FAILED"> }> = {
  "transfer.success": { status: "PAID", from: ["QUEUED", "PROCESSING", "FAILED"] },
  "transfer.failed": { status: "FAILED", from: ["QUEUED", "PROCESSING"] },
  "transfer.reversed": { status: "REVERSED", from: ["QUEUED", "PROCESSING", "PAID"] },
};

export function isTransferEvent(event: string | undefined): event is TransferEvent {
  return event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed";
}

/** Applies a verified Paystack transfer webhook to the matching payout. Returns whether a row changed. */
export async function applyTransferWebhookEvent(
  event: TransferEvent,
  data: { reference?: string; transfer_code?: string; reason?: string } | undefined,
  raw: object
): Promise<boolean> {
  const reference = data?.reference;
  if (!reference) return false;
  const rule = TRANSFER_EVENT_RULES[event];

  const result = await prisma.payout.updateMany({
    where: { reference, status: { in: rule.from } },
    data: {
      status: rule.status,
      ...(rule.status === "PAID" ? { paidAt: new Date(), lastError: null } : { lastError: data?.reason ?? event }),
      ...(data?.transfer_code ? { gatewayTransferId: data.transfer_code } : {}),
      rawPayload: raw as Prisma.InputJsonValue,
    },
  });

  if (result.count > 0 && rule.status !== "PAID") {
    void logError("PAYMENTS", `Payout ${rule.status.toLowerCase()} (webhook)`, { reference, reason: data?.reason });
  }
  return result.count > 0;
}

/**
 * Applies a Flutterwave `transfer.completed` webhook. Flutterwave only sends
 * this event for a finished transfer (SUCCESSFUL or FAILED), so it maps onto
 * the same transition rules as Paystack's success/failed events. The caller
 * must already have re-verified the transfer with Flutterwave's API.
 */
export async function applyFlutterwaveTransferWebhookEvent(
  data: { id?: number | string; reference?: string; status?: string; complete_message?: string } | undefined,
  raw: object
): Promise<boolean> {
  const outcome = classifyTransferStatus(data?.status);
  if (outcome !== "PAID" && outcome !== "FAILED") return false; // NEW / PENDING: nothing final yet
  return applyTransferWebhookEvent(
    outcome === "PAID" ? "transfer.success" : "transfer.failed",
    {
      reference: data?.reference,
      transfer_code: data?.id !== undefined ? String(data.id) : undefined,
      reason: data?.complete_message,
    },
    raw
  );
}
