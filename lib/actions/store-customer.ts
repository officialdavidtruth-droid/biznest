"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authoritative customer boundary. A CUSTOMER session is bound to exactly
 * one store at sign-in (customerStoreId). Every store-facing customer action
 * must pass through this helper instead of looking up membership by userId
 * alone. This prevents a customer session for Store A from being reused to
 * read or mutate Store B data.
 */
export async function requireStoreCustomer(storeSlug: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CUSTOMER" || !session.user.customerStoreId) return null;

  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true },
  });
  if (!store || store.id !== session.user.customerStoreId) return null;

  return prisma.storeCustomer.findFirst({
    where: { userId: session.user.id, storeId: store.id },
    include: { store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true } } },
  });
}

export async function requireStoreCustomerByStoreId(storeId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "CUSTOMER" || session.user.customerStoreId !== storeId) return null;
  return prisma.storeCustomer.findFirst({
    where: { userId: session.user.id, storeId },
    include: { store: { select: { id: true, slug: true, name: true, logoUrl: true, themeColors: true } } },
  });
}

export async function requireStoreCustomerId(storeSlug: string) {
  const membership = await requireStoreCustomer(storeSlug);
  return membership ? { userId: membership.userId, storeId: membership.storeId, membershipId: membership.id } : null;
}
