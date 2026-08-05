"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { VerificationStatus } from "@prisma/client";

async function assertPlatformStaff() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  if (session.user.role !== "PLATFORM_ADMIN" && session.user.role !== "SUPPORT_MODERATOR") {
    return { success: false as const, error: "Platform staff access required." };
  }
  return { success: true as const, userId: session.user.id, role: session.user.role };
}

// --- Overview -----------------------------------------------------------

export async function getPlatformStats() {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const [totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.store.count(),
    prisma.order.count(),
    prisma.user.count({ where: { isBanned: true } }),
  ]);

  return { totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers };
}

// --- Business verification review ---------------------------------------

export async function listBusinesses(status?: VerificationStatus) {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.business.findMany({
    where: status ? { verificationStatus: status } : undefined,
    include: { user: { select: { email: true, name: true } }, store: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBusinessDetail(businessId: string) {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      user: { select: { email: true, name: true, createdAt: true } },
      guarantors: true,
      store: { select: { slug: true, name: true } },
    },
  });
}

export async function approveBusiness(businessId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { success: false, error: "Business not found." };

  await prisma.business.update({
    where: { id: businessId },
    data: {
      verificationStatus: "APPROVED",
      verificationBadge: true,
      reviewedByAdminId: access.userId,
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "BUSINESS_APPROVED", entity: "Business", entityId: businessId },
  });

  revalidatePath("/supaadmin/businesses");
  return { success: true, data: undefined };
}

export async function rejectBusiness(businessId: string, reason: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (!reason.trim()) return { success: false, error: "A rejection reason is required." };

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { success: false, error: "Business not found." };

  await prisma.business.update({
    where: { id: businessId },
    data: {
      verificationStatus: "REJECTED",
      verificationBadge: false,
      reviewedByAdminId: access.userId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "BUSINESS_REJECTED",
      entity: "Business",
      entityId: businessId,
      metadata: { reason },
    },
  });

  revalidatePath("/supaadmin/businesses");
  return { success: true, data: undefined };
}

export async function suspendBusiness(businessId: string, reason: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      verificationStatus: "SUSPENDED",
      verificationBadge: false,
      rejectionReason: reason || null,
      reviewedByAdminId: access.userId,
      reviewedAt: new Date(),
    },
    include: { store: true },
  });

  // Suspending the business takes its storefront offline too.
  if (business.store) {
    await prisma.store.update({ where: { id: business.store.id }, data: { status: "SUSPENDED" } });
  }

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "BUSINESS_SUSPENDED",
      entity: "Business",
      entityId: businessId,
      metadata: { reason },
    },
  });

  revalidatePath("/supaadmin/businesses");
  return { success: true, data: undefined };
}

export async function reinstateBusiness(businessId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const business = await prisma.business.update({
    where: { id: businessId },
    data: { verificationStatus: "APPROVED", verificationBadge: true, rejectionReason: null },
    include: { store: true },
  });

  if (business.store) {
    await prisma.store.update({ where: { id: business.store.id }, data: { status: "ACTIVE" } });
  }

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "BUSINESS_REINSTATED", entity: "Business", entityId: businessId },
  });

  revalidatePath("/supaadmin/businesses");
  return { success: true, data: undefined };
}

// --- Users ----------------------------------------------------------------

export async function listUsers(query?: string) {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.user.findMany({
    where: query
      ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] }
      : undefined,
    select: {
      id: true, name: true, email: true, role: true, isBanned: true,
      emailVerified: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function banUser(userId: string, reason: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (access.userId === userId) return { success: false, error: "You can't ban your own account." };

  await prisma.user.update({ where: { id: userId }, data: { isBanned: true, bannedReason: reason || null } });

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_BANNED", entity: "User", entityId: userId, metadata: { reason } },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  await prisma.user.update({ where: { id: userId }, data: { isBanned: false, bannedReason: null } });

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_UNBANNED", entity: "User", entityId: userId },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

// --- Stores -----------------------------------------------------------------

export async function listStores() {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.store.findMany({
    include: { business: { select: { businessName: true, user: { select: { email: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function suspendStore(storeId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({ where: { id: storeId }, data: { status: "SUSPENDED" } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "STORE_SUSPENDED", entity: "Store", entityId: storeId },
  });

  revalidatePath("/supaadmin/stores");
  return { success: true, data: undefined };
}

export async function reinstateStoreStatus(storeId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({ where: { id: storeId }, data: { status: "ACTIVE" } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "STORE_REINSTATED", entity: "Store", entityId: storeId },
  });

  revalidatePath("/supaadmin/stores");
  return { success: true, data: undefined };
}

// --- Domains ----------------------------------------------------------------

/**
 * Manual override for when a vendor's DNS is confirmed live but the
 * automatic Vercel status check is stuck (transient API failure, etc.).
 * Doesn't call Vercel — just corrects our own record. Use sparingly.
 */
export async function markDomainVerifiedManually(storeId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store?.customDomain) return { success: false, error: "No domain set on this store." };

  await prisma.store.update({ where: { id: storeId }, data: { customDomainStatus: "VERIFIED" } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "DOMAIN_MANUALLY_VERIFIED", entity: "Store", entityId: storeId, metadata: { domain: store.customDomain } },
  });

  revalidatePath("/supaadmin/domains");
  return { success: true, data: undefined };
}
