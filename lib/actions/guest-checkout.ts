"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureAccountProfile } from "@/lib/customer-profile-store";
import { createStoreCustomerSession } from "@/lib/store-customer-auth";
import type { ActionResult } from "@/types/actions";

const guestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  phone: z.string().trim().min(7, "Enter a phone number.").max(30),
});

/**
 * Lets someone check out without choosing a password. A passwordless customer account is created for this
 * store and signed in, so the order, payment and tracking work exactly as for any customer. It can never be
 * signed in to again without a password: an existing account's email is refused (no way to take it over), and
 * a guest who comes back can set a password later with "Forgot password".
 */
export async function continueAsGuest(storeSlug: string, input: { name: string; email: string; phone: string }): Promise<ActionResult<void>> {
  const ip = getClientIp(await headers());
  const rate = await checkRateLimit(`guest-checkout:${ip}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts from this connection. Try again later." };

  const parsed = guestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Check your details." };
  const { name, email, phone } = parsed.data;

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, status: true } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This store isn't available." };

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, customerScopeStoreId: store.id },
    select: { id: true },
  });
  if (existing) return { success: false, error: "This email already has an account here. Log in, or use Forgot password if you haven't set one." };

  const user = await prisma.user.create({
    data: { name, email, phone, role: "CUSTOMER", customerScopeStoreId: store.id },
    select: { id: true },
  });
  await prisma.storeCustomer.create({ data: { userId: user.id, storeId: store.id } });
  await ensureAccountProfile(prisma, { userId: user.id, storeId: store.id, name, email, phone, emailVerified: false });
  await createStoreCustomerSession(user.id, store.id);
  return { success: true, data: undefined };
}
