"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSession, getStoreCustomerSessionForStore, signInStoreCustomer } from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";

/**
 * Password-based sign-in for a storefront customer. This is the one place
 * that should ever call signInStoreCustomer() — /api/store-auth deliberately
 * refuses to manufacture a session from credentials (see the comment in that
 * route), so the login form must come through here instead of that route.
 */
export async function loginStoreCustomer(storeSlug: string, email: string, password: string) {
  return signInStoreCustomer(storeSlug, email, password);
}

/**
 * Authoritative customer boundary. A CUSTOMER session is bound to exactly
 * one store at sign-in (customerStoreId). Every store-facing customer action
 * must pass through this helper instead of looking up membership by userId
 * alone. This prevents a customer session for Store A from being reused to
 * read or mutate Store B data.
 */
export async function requireStoreCustomer(storeSlug: string) {
  const customerSession = await getStoreCustomerSessionForStore(storeSlug);
  const session = customerSession ? null : await auth();
  const userId = customerSession?.user?.id ?? (session?.user?.role === "CUSTOMER" ? session.user.id : null);
  const customerStoreId = customerSession?.user?.customerStoreId ?? (session?.user?.role === "CUSTOMER" ? session.user.customerStoreId : null);
  if (!userId || !customerStoreId) return null;

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true },
  });
  if (!store || store.id !== customerStoreId) return null;

  return prisma.storeCustomer.findFirst({
    where: { userId, storeId: store.id },
    include: {
      store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function requireStoreCustomerByStoreId(storeId: string) {
  const customerSession = await getStoreCustomerSession();
  const session = customerSession ? null : await auth();
  const userId = customerSession?.user?.id ?? (session?.user?.role === "CUSTOMER" ? session.user.id : null);
  const customerStoreId = customerSession?.user?.customerStoreId ?? (session?.user?.role === "CUSTOMER" ? session.user.customerStoreId : null);
  if (!userId || customerStoreId !== storeId) return null;
  return prisma.storeCustomer.findFirst({
    where: { userId, storeId },
    include: { store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true } } },
  });
}

export async function requireStoreCustomerId(storeSlug: string) {
  const membership = await requireStoreCustomer(storeSlug);
  return membership ? { userId: membership.userId, storeId: membership.storeId, membershipId: membership.id } : null;
}