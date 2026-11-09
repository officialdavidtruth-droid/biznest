import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { initiateFlutterwaveTransfer, findFlutterwaveTransferByReference } from "@/lib/payments/flutterwave";
import { getVendorReferralConfig, ruleForPlan } from "@/lib/referrals/vendor-config";
import { buildWallet, type Wallet } from "@/lib/referrals/wallet";

const DAY = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ATTEMPTS = 5;

function hashIp(ip: string) {
  return crypto.createHash("sha256").update(`${ip}:${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

export function newReferralCode() {
  let s = "BN";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

/** The vendor's code, created on first use. Only people with a business can have one. */
export async function ensureVendorReferralCode(userId: string): Promise<string | null> {
  const existing = await prisma.vendorReferralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;
  const hasBusiness = await prisma.business.findUnique({ where: { userId }, select: { id: true } });
  if (!hasBusiness) return null;
  for (let i = 0; i < 6; i++) {
    try {
      const row = await prisma.vendorReferralCode.create({ data: { userId, code: newReferralCode() } });
      return row.code;
    } catch {
      const again = await prisma.vendorReferralCode.findUnique({ where: { userId } });
      if (again) return again.code;
    }
  }
  return null;
}

/**
 * Called once when a brand-new platform account signs up with ?ref=CODE. The referrer is fixed here and
 * never changes. Suspicious signals are recorded as flags for SupaAdmin; only an outright self-referral is refused.
 */
export async function attachVendorReferralAtSignup(params: { refereeId: string; refereeEmail: string; refereePhone?: string | null; code: string; ip: string }) {
  const code = params.code.trim().toUpperCase().slice(0, 16);
  if (!code) return { ok: false as const };
  const row = await prisma.vendorReferralCode.findUnique({ where: { code }, include: { user: { select: { id: true, email: true, phone: true, isBanned: true } } } });
  if (!row || row.user.isBanned) return { ok: false as const };
  if (row.userId === params.refereeId || row.user.email.toLowerCase() === params.refereeEmail.toLowerCase()) return { ok: false as const };

  const ipHash = hashIp(params.ip);
  const flags: string[] = [];
  if (params.refereePhone && row.user.phone && params.refereePhone.replace(/\D/g, "") === row.user.phone.replace(/\D/g, "")) flags.push("same_phone");
  const sameIp = await prisma.vendorReferral.count({ where: { referrerId: row.userId, signupIpHash: ipHash } });
  if (sameIp > 0) flags.push("same_ip");
  const lastDay = await prisma.vendorReferral.count({ where: { referrerId: row.userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  if (lastDay >= 10) flags.push("burst");

  try {
    await prisma.vendorReferral.create({ data: { referrerId: row.userId, refereeId: params.refereeId, codeId: row.id, flags, signupIpHash: ipHash } });
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

/**
 * A referred vendor's plan payment was just confirmed. Starts the reward (held for the refund window).
 * Safe to call repeatedly and from several payment paths: only the first call for a referee does anything.
 * Never throws, so it can never break a payment.
 */
export async function creditVendorReferralForPlanPayment(params: { storeId: string; planId: string; paymentReference: string }) {
  try {
    const config = await getVendorReferralConfig();
    if (!config.enabled) return;
    const store = await prisma.store.findUnique({
      where: { id: params.storeId },
      select: { payoutAccountNumber: true, business: { select: { userId: true } } },
    });
    const refereeId = store?.business?.userId;
    if (!store || !refereeId) return;
    const referral = await prisma.vendorReferral.findUnique({ where: { refereeId } });
    if (!referral || referral.status !== "SIGNED_UP") return;

    const plan = await prisma.subscription.findUnique({ where: { id: params.planId } });
    if (!plan) return;
    const rule = ruleForPlan(plan, config);
    if (!rule) return;

    // The person who referred them must not be paying themselves through a second account.
    const referrerStore = await prisma.store.findFirst({ where: { business: { userId: referral.referrerId } }, select: { payoutAccountNumber: true } });
    if (store.payoutAccountNumber && referrerStore?.payoutAccountNumber && store.payoutAccountNumber === referrerStore.payoutAccountNumber) {
      await prisma.vendorReferral.updateMany({ where: { id: referral.id, status: "SIGNED_UP" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Same bank account as the referrer" } });
      return;
    }

    const now = new Date();
    await prisma.vendorReferral.updateMany({
      where: { id: referral.id, status: "SIGNED_UP" },
      data: {
        status: "PENDING",
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
        reward: rule.reward,
        unlockCount: rule.unlockCount,
        paymentReference: params.paymentReference,
        paidAt: now,
        confirmAt: new Date(now.getTime() + config.holdDays * DAY),
      },
    });
  } catch (err) {
    console.error("creditVendorReferralForPlanPayment failed", err);
  }
}

/**
 * Daily job. (1) Picks up any referred vendor whose plan payment the hooks missed. (2) Confirms rewards whose
 * refund window has ended, or cancels them if the payment was refunded, someone is banned, or a bank account clashes.
 */
export async function matureVendorReferrals() {
  let picked = 0;
  let confirmed = 0;
  let cancelled = 0;
  const now = new Date();

  const waiting = await prisma.vendorReferral.findMany({
    where: { status: "SIGNED_UP" },
    select: { referee: { select: { business: { select: { store: { select: { id: true, subscriptionId: true } } } } } } },
    take: 300,
    orderBy: { createdAt: "asc" },
  });
  for (const w of waiting) {
    const store = w.referee.business?.store;
    if (!store?.subscriptionId) continue;
    const pay = await prisma.payment.findFirst({
      where: { storeId: store.id, purpose: "SUBSCRIPTION_UPGRADE", status: "SUCCESSFUL", amount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      select: { reference: true },
    });
    if (!pay) continue;
    await creditVendorReferralForPlanPayment({ storeId: store.id, planId: store.subscriptionId, paymentReference: pay.reference });
    picked++;
  }

  const due = await prisma.vendorReferral.findMany({
    where: { status: "PENDING", confirmAt: { lte: now } },
    select: {
      id: true,
      paymentReference: true,
      referrer: { select: { isBanned: true } },
      referee: { select: { isBanned: true, business: { select: { store: { select: { payoutAccountNumber: true } } } } } },
      referrerId: true,
    },
    take: 300,
  });
  for (const r of due) {
    const payment = r.paymentReference ? await prisma.payment.findUnique({ where: { reference: r.paymentReference }, select: { status: true } }) : null;
    let reason: string | null = null;
    if (!payment || payment.status !== "SUCCESSFUL") reason = "Plan payment was refunded or not confirmed";
    else if (r.referrer.isBanned || r.referee.isBanned) reason = "Account banned";
    else {
      const refereeAcct = r.referee.business?.store?.payoutAccountNumber;
      if (refereeAcct) {
        const referrerStore = await prisma.store.findFirst({ where: { business: { userId: r.referrerId } }, select: { payoutAccountNumber: true } });
        if (referrerStore?.payoutAccountNumber === refereeAcct) reason = "Same bank account as the referrer";
      }
    }
    if (reason) {
      await prisma.vendorReferral.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason } });
      cancelled++;
    } else {
      await prisma.vendorReferral.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "CONFIRMED", confirmedAt: now } });
      confirmed++;
    }
  }
  return { picked, confirmed, cancelled };
}

// ---------------------------------------------------------------------------
// Wallet (derived from the referral rows, so there is no balance to drift)
// ---------------------------------------------------------------------------

export async function getWallet(userId: string): Promise<Wallet> {
  const [rows, withdrawals] = await Promise.all([
    prisma.vendorReferral.findMany({
      where: { referrerId: userId },
      select: { id: true, planId: true, planName: true, reward: true, unlockCount: true, status: true, withdrawalId: true, confirmedAt: true },
      orderBy: [{ confirmedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.vendorReferralWithdrawal.findMany({ where: { userId }, select: { status: true, amount: true } }),
  ]);
  return buildWallet(rows, withdrawals);
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

export type WithdrawResult = { ok: true; amount: number; status: string } | { ok: false; error: string };

export async function requestVendorReferralWithdrawal(userId: string): Promise<WithdrawResult> {
  const config = await getVendorReferralConfig();
  if (!config.enabled) return { ok: false, error: "The referral program is paused right now." };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
  if (!user || user.isBanned) return { ok: false, error: "This account can't withdraw." };

  const store = await prisma.store.findFirst({
    where: { business: { userId } },
    select: { payoutBankCode: true, payoutAccountNumber: true, payoutDetails: true },
  });
  if (!store?.payoutBankCode || !store.payoutAccountNumber) return { ok: false, error: "Connect your bank account in Payouts first, then withdraw." };
  const details = (store.payoutDetails ?? {}) as { bankName?: string; accountName?: string };

  const open = await prisma.vendorReferralWithdrawal.count({ where: { userId, status: { in: ["REVIEW", "QUEUED", "PROCESSING"] } } });
  if (open > 0) return { ok: false, error: "You already have a withdrawal in progress. Wait for it to finish." };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = await tx.vendorReferral.findMany({
        where: { referrerId: userId },
        select: { id: true, planId: true, planName: true, reward: true, unlockCount: true, status: true, withdrawalId: true, confirmedAt: true },
        orderBy: [{ confirmedAt: "asc" }, { createdAt: "asc" }],
      });
      const wallet = buildWallet(rows, []);
      const ids = wallet.groups.flatMap((g) => g.ids);
      if (ids.length === 0 || wallet.withdrawable <= 0) throw new Error("LOCKED");
      const needsReview = wallet.withdrawable > config.reviewAbove;
      const w = await tx.vendorReferralWithdrawal.create({
        data: {
          userId,
          amount: wallet.withdrawable,
          status: needsReview ? "REVIEW" : "QUEUED",
          reference: `REFWD-${crypto.randomBytes(10).toString("hex")}`,
          bankCode: store.payoutBankCode!,
          accountNumber: store.payoutAccountNumber!,
          accountName: details.accountName ?? null,
          bankName: details.bankName ?? null,
        },
      });
      // Claim the exact rows. If any was taken by a parallel request, the count differs and everything rolls back.
      const claimed = await tx.vendorReferral.updateMany({ where: { id: { in: ids }, status: "CONFIRMED", withdrawalId: null }, data: { withdrawalId: w.id } });
      if (claimed.count !== ids.length) throw new Error("RACE");
      return w;
    });
    if (created.status === "QUEUED") await processVendorReferralWithdrawal(created.id);
    const fresh = await prisma.vendorReferralWithdrawal.findUnique({ where: { id: created.id }, select: { status: true } });
    return { ok: true, amount: Number(created.amount), status: fresh?.status ?? created.status };
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "LOCKED") return { ok: false, error: "Nothing is unlocked yet. Withdrawals open once you reach the number of paying referrals for a plan." };
    if (m === "RACE") return { ok: false, error: "Your wallet changed while withdrawing. Refresh and try again." };
    console.error("requestVendorReferralWithdrawal failed", err);
    return { ok: false, error: "Couldn't start the withdrawal. Try again." };
  }
}

/** Gives the rewards back to the wallet (used when a transfer definitively failed or an admin rejected it). */
async function releaseWithdrawal(id: string) {
  await prisma.vendorReferral.updateMany({ where: { withdrawalId: id }, data: { withdrawalId: null } });
}

/** Sends (or re-checks) one withdrawal. Safe to call repeatedly: the transfer reference is fixed per withdrawal. */
export async function processVendorReferralWithdrawal(id: string) {
  const claimed = await prisma.vendorReferralWithdrawal.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;
  const w = await prisma.vendorReferralWithdrawal.findUnique({ where: { id } });
  if (!w) return;

  const fail = async (message: string) => {
    if (w.attempts >= MAX_ATTEMPTS) {
      await prisma.vendorReferralWithdrawal.update({ where: { id }, data: { status: "FAILED", lastError: message } });
      await releaseWithdrawal(id);
    } else {
      await prisma.vendorReferralWithdrawal.update({ where: { id }, data: { status: "QUEUED", lastError: message } });
    }
  };

  try {
    // If an earlier attempt already reached Flutterwave (timeout after sending), never send twice.
    const existing = await findFlutterwaveTransferByReference(w.reference);
    let data = existing.data[0];
    if (!data) {
      const res = await initiateFlutterwaveTransfer({
        bankCode: w.bankCode,
        accountNumber: w.accountNumber,
        amountNaira: Number(w.amount),
        reference: w.reference,
        narration: "BizNest referral reward",
        beneficiaryName: w.accountName ?? undefined,
      });
      if (res.status !== "success" || !res.data) return fail(res.message || "Transfer was not accepted");
      data = res.data;
    }
    await applyTransferState(id, data.status, data.id, data.complete_message);
  } catch (err) {
    await fail(err instanceof Error ? err.message : "Transfer failed");
  }
}

async function applyTransferState(id: string, state: string, transferId: number | string | undefined, message?: string) {
  if (state === "SUCCESSFUL") {
    await prisma.vendorReferralWithdrawal.updateMany({
      where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "PAID", paidAt: new Date(), gatewayTransferId: transferId ? String(transferId) : undefined, lastError: null },
    });
  } else if (state === "FAILED") {
    const r = await prisma.vendorReferralWithdrawal.updateMany({
      where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "FAILED", lastError: message ?? "Transfer failed", gatewayTransferId: transferId ? String(transferId) : undefined },
    });
    if (r.count > 0) await releaseWithdrawal(id);
  } else {
    await prisma.vendorReferralWithdrawal.updateMany({
      where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "PROCESSING", gatewayTransferId: transferId ? String(transferId) : undefined, lastError: null },
    });
  }
}

/** Flutterwave's verified `transfer.completed` outcome for a REFWD- transfer. */
export async function applyVendorReferralTransferWebhook(data: { id: number; reference: string; status: string; complete_message?: string }) {
  const w = await prisma.vendorReferralWithdrawal.findUnique({ where: { reference: data.reference }, select: { id: true } });
  if (!w) return;
  await applyTransferState(w.id, data.status, data.id, data.complete_message);
}

/** Daily: retries queued withdrawals and settles ones stuck in PROCESSING. */
export async function retryVendorReferralWithdrawals() {
  let retried = 0;
  const queued = await prisma.vendorReferralWithdrawal.findMany({ where: { status: "QUEUED", attempts: { lt: MAX_ATTEMPTS } }, select: { id: true }, take: 50 });
  for (const q of queued) {
    await processVendorReferralWithdrawal(q.id);
    retried++;
  }
  const stuck = await prisma.vendorReferralWithdrawal.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
    select: { id: true, reference: true },
    take: 50,
  });
  for (const s of stuck) {
    try {
      const found = await findFlutterwaveTransferByReference(s.reference);
      const d = found.data[0];
      if (d) await applyTransferState(s.id, d.status, d.id, d.complete_message);
    } catch {
      /* try again tomorrow */
    }
  }
  return { retried, checked: stuck.length };
}

// SupaAdmin actions on a withdrawal waiting for review.
export async function approveVendorReferralWithdrawal(id: string) {
  const r = await prisma.vendorReferralWithdrawal.updateMany({ where: { id, status: "REVIEW" }, data: { status: "QUEUED" } });
  if (r.count > 0) await processVendorReferralWithdrawal(id);
  return r.count > 0;
}

export async function rejectVendorReferralWithdrawal(id: string, reason: string) {
  const r = await prisma.vendorReferralWithdrawal.updateMany({ where: { id, status: "REVIEW" }, data: { status: "CANCELLED", lastError: reason } });
  if (r.count > 0) await releaseWithdrawal(id);
  return r.count > 0;
}
