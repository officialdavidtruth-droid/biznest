"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { sendOrderNotificationEmail } from "@/lib/email/send";

// ============================================================================
// ORDER RECOVERY
//
// Order.buyerId is fixed to whichever account was signed in at the moment
// checkout completed. If a customer gets logged out mid-checkout (or later
// signs in with a different account for the same email -- e.g. password
// login vs. Google, or a typo'd email that auto-created a second account),
// the order becomes invisible to them: "My Orders" only ever shows orders
// where buyerId matches the CURRENT session (see listOrdersForBuyerAtStore).
// The order itself isn't lost -- it's just attached to the wrong account.
//
// This is a two-step, email-verified claim so a customer can't pull orders
// belonging to someone else just by knowing their email:
//   1. requestOrderRecovery -- customer enters the email used at checkout;
//      if it has any orders at this store not already on their current
//      account, a one-time 6-digit code is emailed to that address.
//   2. confirmOrderRecovery -- customer enters the code; on match, every
//      matching order's buyerId is reassigned to their current account.
// ============================================================================

const CODE_TTL_MS = 15 * 60 * 1000;

type StoreSessionContext =
  | { ok: true; userId: string; store: { id: string; name: string } }
  | { ok: false; error: string };

async function getStoreAndVerifiedSession(storeSlug: string): Promise<StoreSessionContext> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    return { ok: false, error: "Sign in to your account first, then recover the order into it." };
  }
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true } });
  if (!store) return { ok: false, error: "Store not found." };
  if (session.user.customerStoreId !== store.id) {
    return { ok: false, error: "Sign in to your account at this store first." };
  }
  return { ok: true, userId: session.user.id, store };
}

async function createRecoveryCode(identifier: string) {
  // token is globally unique, so a 6-digit code can theoretically collide
  // with someone else's in-flight code -- retry with a fresh one rather
  // than surface that as a user-facing error.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 1000000));
    try {
      await prisma.verificationToken.create({
        data: { identifier, token: code, expires: new Date(Date.now() + CODE_TTL_MS), type: "ORDER_RECOVERY" },
      });
      return code;
    } catch {
      continue;
    }
  }
  throw new Error("Could not generate a recovery code — please try again.");
}

export async function requestOrderRecovery(storeSlug: string, email: string): Promise<ActionResult> {
  const ctx = await getStoreAndVerifiedSession(storeSlug);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { success: false, error: "Enter the email you used at checkout." };

  const matchCount = await prisma.order.count({
    where: { storeId: ctx.store.id, buyerId: { not: ctx.userId }, buyer: { email: normalizedEmail } },
  });

  // Same response whether or not anything matched -- this shouldn't
  // confirm to a caller which emails have order history at this store.
  if (matchCount === 0) return { success: true, data: undefined };

  const identifier = `${ctx.store.id}:${normalizedEmail}`;
  await prisma.verificationToken.deleteMany({ where: { identifier, type: "ORDER_RECOVERY" } });
  const code = await createRecoveryCode(identifier);

  await sendOrderNotificationEmail(
    normalizedEmail,
    `Your order recovery code for ${ctx.store.name}`,
    `Someone requested to recover ${matchCount === 1 ? "an order" : "orders"} at <strong>${ctx.store.name}</strong> into an account signed in with this email. Your code is <strong style="font-size:18px;letter-spacing:2px;">${code}</strong>. It expires in 15 minutes. If this wasn't you, you can safely ignore this email — nothing happens without the code.`
  );

  return { success: true, data: undefined };
}

export async function confirmOrderRecovery(storeSlug: string, email: string, code: string): Promise<ActionResult<{ recoveredCount: number }>> {
  const ctx = await getStoreAndVerifiedSession(storeSlug);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();
  if (!normalizedCode) return { success: false, error: "Enter the code from your email." };

  const identifier = `${ctx.store.id}:${normalizedEmail}`;
  const record = await prisma.verificationToken.findUnique({ where: { token: normalizedCode } });
  if (!record || record.identifier !== identifier || record.type !== "ORDER_RECOVERY") {
    return { success: false, error: "That code is incorrect." };
  }
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: record.token } }).catch(() => {});
    return { success: false, error: "That code has expired — request a new one." };
  }

  const orders = await prisma.order.findMany({
    where: { storeId: ctx.store.id, buyerId: { not: ctx.userId }, buyer: { email: normalizedEmail } },
    select: { id: true },
  });
  await prisma.verificationToken.delete({ where: { token: record.token } }).catch(() => {});

  if (orders.length === 0) {
    return { success: false, error: "Nothing left to recover for that email — it may have already been claimed." };
  }

  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { buyerId: ctx.userId },
  });

  revalidatePath(`/store/${storeSlug}/orders`);
  revalidatePath(`/store/${storeSlug}/account`);
  return { success: true, data: { recoveredCount: orders.length } };
}
