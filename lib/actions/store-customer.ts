"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSession } from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";

/**
 * Authoritative customer boundary. A CUSTOMER session is bound to exactly
 * one store at sign-in (customerStoreId). Every store-facing customer action
 * must pass through this helper instead of looking up membership by userId
 * alone. This prevents a customer session for Store A from being reused to
 * read or mutate Store B data.
 */
export async function requireStoreCustomer(storeSlug: string) {
  const customerSession = await getStoreCustomerSession(storeSlug);
  const session = customerSession ? null : await auth();
  const userId = customerSession?.id ?? (session?.user?.role === "CUSTOMER" ? session.user.id : null);
  const customerStoreId = customerSession?.storeId ?? (session?.user?.role === "CUSTOMER" ? session.user.customerStoreId : null);
  if (!userId || !customerStoreId) return null;

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true },
  });
  if (!store || store.id !== customerStoreId) return null;

  return prisma.storeCustomer.findFirst({
    where: { userId, storeId: store.id },
    include: { store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true } } },
  });
}

export async function requireStoreCustomerByStoreId(storeId: string) {
  const customerSession = await getStoreCustomerSession();
  const session = customerSession ? null : await auth();
  const userId = customerSession?.id ?? (session?.user?.role === "CUSTOMER" ? session.user.id : null);
  const customerStoreId = customerSession?.storeId ?? (session?.user?.role === "CUSTOMER" ? session.user.customerStoreId : null);
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
