"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { VerificationStatus, UserRole } from "@prisma/client";

async function assertPlatformStaff() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  if (session.user.role !== "PLATFORM_ADMIN" && session.user.role !== "SUPPORT_MODERATOR") {
    return { success: false as const, error: "Platform staff access required." };
  }
  return { success: true as const, userId: session.user.id, role: session.user.role };
}

// Role/user-deletion/plan-pricing/gateway changes are deliberately
// PLATFORM_ADMIN-only — a step above the general staff check above, which
// SUPPORT_MODERATOR also passes for the day-to-day moderation actions.
async function assertPlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  if (session.user.role !== "PLATFORM_ADMIN") {
    return { success: false as const, error: "Platform admin access required." };
  }
  return { success: true as const, userId: session.user.id };
}

// --- Overview -----------------------------------------------------------

export async function getPlatformStats() {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const [totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers, paidOrders, activeSubs, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.store.count(),
    prisma.order.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.order.findMany({ where: { status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } }, select: { total: true } }),
    prisma.store.findMany({ where: { subscriptionId: { not: null } }, select: { subscription: { select: { price: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true, email: true } } } }),
  ]);

  const gmv = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const mrr = activeSubs.reduce((sum, s) => sum + Number(s.subscription?.price ?? 0), 0);

  return { totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers, gmv, mrr, recentLogs };
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

// --- User role management (upgrade/downgrade) ------------------------------

const ASSIGNABLE_ROLES: UserRole[] = ["CUSTOMER", "STORE_OWNER", "SUPPORT_MODERATOR", "PLATFORM_ADMIN"];

export async function changeUserRole(userId: string, role: UserRole): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };
  if (!ASSIGNABLE_ROLES.includes(role)) return { success: false, error: "Not a valid role." };
  if (access.userId === userId && role !== "PLATFORM_ADMIN") {
    return { success: false, error: "You can't downgrade your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: "User not found." };

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_ROLE_CHANGED", entity: "User", entityId: userId, metadata: { from: target.role, to: role } },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

/**
 * Hard delete. Only allowed for users with no store/business behind them
 * (customers, or staff accounts) — a store owner with an active business
 * should be suspended/banned instead, since deleting them would orphan
 * their orders, products, and everything a real customer bought from them.
 * Use banUser for that case; this is for cleaning up spam/test accounts.
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };
  if (access.userId === userId) return { success: false, error: "You can't delete your own account." };

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { business: true } });
  if (!target) return { success: false, error: "User not found." };
  if (target.business) {
    return { success: false, error: "This user owns a business/store. Suspend or ban them instead of deleting — deleting would orphan their store's orders and products." };
  }

  await prisma.user.delete({ where: { id: userId } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_DELETED", entity: "User", entityId: userId, metadata: { email: target.email } },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

// --- Activity log -----------------------------------------------------------

export async function listActivityLogs(params: { query?: string; action?: string; page?: number } = {}) {
  const access = await assertPlatformStaff();
  if (!access.success) return { logs: [], total: 0 };

  const page = params.page ?? 1;
  const pageSize = 50;
  const where = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.query
      ? {
          OR: [
            { entity: { contains: params.query, mode: "insensitive" as const } },
            { entityId: { contains: params.query, mode: "insensitive" as const } },
            { user: { email: { contains: params.query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, pageSize };
}

export async function listDistinctLogActions() {
  const access = await assertPlatformStaff();
  if (!access.success) return [];
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}

// --- Plan pricing (billing) -------------------------------------------------
// Prices edited here are the single source of truth — the landing page
// pricing section and every store owner's upgrade screen both read live
// from the Subscription table, so a change here takes effect everywhere
// immediately with no other code to touch.

export async function listPlans() {
  const access = await assertPlatformStaff();
  if (!access.success) return [];
  return prisma.subscription.findMany({ orderBy: { price: "asc" } });
}

export async function updatePlanPricing(
  planId: string,
  input: { price: number; commissionRate: number; isActive: boolean }
): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };
  if (input.price < 0 || input.commissionRate < 0 || input.commissionRate > 100) {
    return { success: false, error: "Enter a valid price and commission rate (0–100%)." };
  }

  const plan = await prisma.subscription.findUnique({ where: { id: planId } });
  if (!plan) return { success: false, error: "Plan not found." };

  await prisma.subscription.update({
    where: { id: planId },
    data: { price: input.price, commissionRate: input.commissionRate, isActive: input.isActive },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "PLAN_PRICING_UPDATED",
      entity: "Subscription",
      entityId: planId,
      metadata: { plan: plan.name, from: { price: plan.price, commissionRate: plan.commissionRate }, to: input },
    },
  });

  // Landing page + every store's /admin/subscription screen read this table
  // live on every request, so no extra revalidation is strictly required —
  // these just cover any statically-cached edge cases.
  revalidatePath("/");
  revalidatePath("/supaadmin/subscriptions");
  return { success: true, data: undefined };
}
