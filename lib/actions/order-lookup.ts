"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { orderTrackingToken } from "@/lib/order-tracking";
import type { ActionResult } from "@/types/actions";

const NOT_FOUND = "We couldn't find an order with those details. Check the order number and the email you used.";

/**
 * "Track my order" without signing in: the order number (shown on the receipt) plus the email used at checkout
 * returns the sign-in-free tracking page. Both must match, and the answer is the same whichever one was wrong.
 */
export async function findOrderToTrack(storeSlug: string, orderNumber: string, email: string): Promise<ActionResult<{ path: string }>> {
  const ip = getClientIp(await headers());
  const rate = await checkRateLimit(`order-lookup:${ip}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts. Try again in a few minutes." };

  const ref = orderNumber.replace(/^#/, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const mail = email.trim().toLowerCase();
  if (ref.length < 8 || !z.string().email().safeParse(mail).success) return { success: false, error: NOT_FOUND };

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (!store) return { success: false, error: NOT_FOUND };

  const order = await prisma.order.findFirst({
    where: { storeId: store.id, id: { endsWith: ref.slice(-8) }, buyer: { email: { equals: mail, mode: "insensitive" } } },
    select: { id: true },
  });
  if (!order) return { success: false, error: NOT_FOUND };
  return { success: true, data: { path: `/store/${storeSlug}/order-status/${order.id}?t=${orderTrackingToken(order.id)}` } };
}

/** Whether the signed-in customer is a guest (no password yet): drives the "set a password" prompt. */
export async function isGuestCustomer(storeSlug: string): Promise<boolean> {
  const session = await getStoreCustomerSessionForStore(storeSlug);
  if (!session?.user?.id) return false;
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  return !!u && !u.passwordHash;
}

/** Turns the signed-in guest into a normal account by setting a password. Only works from their own session. */
export async function setGuestPassword(storeSlug: string, password: string): Promise<ActionResult<void>> {
  const session = await getStoreCustomerSessionForStore(storeSlug);
  if (!session?.user?.id) return { success: false, error: "Please sign in again." };
  if (password.length < 8 || password.length > 100) return { success: false, error: "Use a password of at least 8 characters." };
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!u) return { success: false, error: "Account not found." };
  if (u.passwordHash) return { success: false, error: "This account already has a password." };
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  return { success: true, data: undefined };
}
