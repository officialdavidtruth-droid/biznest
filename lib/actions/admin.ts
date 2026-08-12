"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { VerificationStatus, UserRole, DisputeStatus } from "@prisma/client";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { recomputeAndPersistTrustScore } from "@/lib/actions/trust-score";

// Platform-admin access is gated by the shared ADMIN_PIN cookie now, not by
// a signed-in user's role — see lib/admin-pin-auth.ts. There's only one
// admin identity, so there's no userId to attribute actions to; audit log
// entries below use null and rely on the action name + entity for context.
async function assertPlatformStaff() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  return { success: true as const, userId: null as string | null };
}

// Kept as a distinct name for call sites that previously required the
// stricter PLATFORM_ADMIN-only role — with a single shared PIN there's no
// tier distinction left, so this is now identical to assertPlatformStaff.
const assertPlatformAdmin = assertPlatformStaff;

// --- Overview -----------------------------------------------------------

export async function getPlatformStats() {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const [totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers, paidOrders, activeSubs, recentLogs, openDisputes] = await Promise.all([
    prisma.user.count(),
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.store.count(),
    prisma.order.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.order.findMany({ where: { status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } }, select: { total: true } }),
    prisma.store.findMany({ where: { subscriptionId: { not: null } }, select: { subscription: { select: { price: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true, email: true } } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);

  const gmv = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const mrr = activeSubs.reduce((sum, s) => sum + Number(s.subscription?.price ?? 0), 0);

  return { totalUsers, pendingBusinesses, totalStores, totalOrders, bannedUsers, gmv, mrr, recentLogs, openDisputes };
}

// Cheap counts for sidebar nav badges — deliberately separate from
// getPlatformStats (which also pulls GMV/MRR/order sums) so every admin
// page render doesn't pay for the heavier aggregation just to paint a
// couple of nav badges.
export async function getAdminBadgeCounts() {
  const access = await assertPlatformStaff();
  if (!access.success) return { pendingBusinesses: 0, openDisputes: 0 };

  const [pendingBusinesses, openDisputes] = await Promise.all([
    prisma.business.count({ where: { verificationStatus: "PENDING" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);

  return { pendingBusinesses, openDisputes };
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

  await recomputeAndPersistTrustScore(businessId);
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

  await recomputeAndPersistTrustScore(businessId);
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

  await recomputeAndPersistTrustScore(businessId);
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

  await recomputeAndPersistTrustScore(businessId);
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
      business: {
        select: {
          store: {
            select: {
              id: true, subscriptionId: true, trialEndsAt: true,
              subscription: { select: { id: true, name: true } },
            },
          },
        },
      },
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

// --- User plan management (upgrade/downgrade/free trials) ------------------
// Plans live on Store, not User (a store's plan is what actually gates
// features/commission), so these look up the user's store under the hood.
// changeUserRole above still exists for the handful of override checks
// elsewhere in the app, but the Users page itself no longer surfaces role —
// plan + trial are what platform staff actually manage per-user day to day.

async function getUserStore(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { business: { include: { store: true } } },
  });
  return user?.business?.store ?? null;
}

export async function forceLogoutUser(userId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  await prisma.user.update({ where: { id: userId }, data: { sessionsInvalidatedAt: new Date() } });

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_FORCE_LOGOUT", entity: "User", entityId: userId },
  });

  return { success: true, data: undefined };
}

export async function changeUserPlan(userId: string, subscriptionId: string | null): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const store = await getUserStore(userId);
  if (!store) return { success: false, error: "This user doesn't have a store yet." };

  if (subscriptionId) {
    const plan = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!plan) return { success: false, error: "Plan not found." };
  }

  await prisma.store.update({
    where: { id: store.id },
    // A manual plan change (as opposed to a trial) clears any existing
    // trial — the new plan is the real, billed plan from here on.
    data: { subscriptionId, trialEndsAt: null },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "USER_PLAN_CHANGED",
      entity: "Store",
      entityId: store.id,
      metadata: { from: store.subscriptionId, to: subscriptionId },
    },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

export async function grantUserTrial(userId: string, subscriptionId: string, days: number): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { success: false, error: "Enter a trial length between 1 and 365 days." };
  }

  const store = await getUserStore(userId);
  if (!store) return { success: false, error: "This user doesn't have a store yet." };

  const plan = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!plan) return { success: false, error: "Plan not found." };

  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await prisma.store.update({
    where: { id: store.id },
    data: { subscriptionId, trialEndsAt },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "USER_TRIAL_GRANTED",
      entity: "Store",
      entityId: store.id,
      metadata: { plan: plan.name, days, trialEndsAt },
    },
  });

  revalidatePath("/supaadmin/users");
  return { success: true, data: undefined };
}

export async function endUserTrial(userId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const store = await getUserStore(userId);
  if (!store) return { success: false, error: "This user doesn't have a store yet." };

  await prisma.store.update({ where: { id: store.id }, data: { trialEndsAt: null } });

  await prisma.auditLog.create({
    data: { userId: access.userId, action: "USER_TRIAL_ENDED", entity: "Store", entityId: store.id },
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

// --- Dispute resolution (Resolution Center) ---------------------------------
//
// The platform-side half of app/disputes/[orderId]/page.tsx (which is where
// the buyer and seller submit evidence, message each other, and see delivery
// / payment info). Everything here is read-only for admins except the final
// decision — admins never edit evidence or post into the buyer/seller thread,
// only review it and rule.

export async function listDisputes(status?: DisputeStatus) {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.dispute.findMany({
    where: status ? { status } : undefined,
    include: {
      raisedBy: { select: { name: true, email: true } },
      order: {
        select: {
          id: true,
          total: true,
          currency: true,
          status: true,
          buyer: { select: { name: true, email: true } },
          store: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDisputeForAdmin(disputeId: string) {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      raisedBy: { select: { id: true, name: true, email: true } },
      evidence: {
        include: { submittedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      order: {
        include: {
          items: { include: { product: true, service: true } },
          buyer: { select: { id: true, name: true, email: true, phone: true } },
          deliveryZone: true,
          payments: { orderBy: { createdAt: "desc" } },
          statusEvents: { orderBy: { createdAt: "asc" } },
          store: {
            select: {
              name: true,
              slug: true,
              contactEmail: true,
              contactPhone: true,
              business: { select: { userId: true, businessName: true, phone: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!dispute) return null;

  const conversation = await prisma.conversation.findUnique({
    where: { orderId: dispute.orderId },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } } },
  });

  return { dispute, messages: conversation?.messages ?? [] };
}

export async function claimDisputeForReview(disputeId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return { success: false, error: "Dispute not found." };
  if (dispute.status !== "OPEN") return { success: false, error: "Only an open dispute can be moved to review." };

  await prisma.dispute.update({ where: { id: disputeId }, data: { status: "UNDER_REVIEW" } });
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "DISPUTE_UNDER_REVIEW", entity: "Dispute", entityId: disputeId },
  });

  revalidatePath("/supaadmin/disputes");
  revalidatePath(`/supaadmin/disputes/${disputeId}`);
  return { success: true, data: undefined };
}

const DISPUTE_DECISIONS: DisputeStatus[] = ["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"];

/**
 * The admin decision. RESOLVED_BUYER sides with the buyer (order flips to
 * REFUNDED — the actual gateway refund still has to be issued from the
 * store's refund control, same as any other refund, so support can attach
 * the right payment reference); RESOLVED_SELLER sides with the seller
 * (order returns to COMPLETED); CLOSED ends it with no action either way
 * (order returns to whatever it would've been — COMPLETED — since "closed,
 * no fault found" isn't a cancellation).
 */
export async function resolveDispute(
  disputeId: string,
  decision: DisputeStatus,
  adminNotes: string
): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  if (!DISPUTE_DECISIONS.includes(decision)) return { success: false, error: "Invalid decision." };
  if (!adminNotes.trim()) return { success: false, error: "A note explaining the decision is required." };

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return { success: false, error: "Dispute not found." };
  if (dispute.status === "RESOLVED_BUYER" || dispute.status === "RESOLVED_SELLER" || dispute.status === "CLOSED") {
    return { success: false, error: "This dispute has already been resolved." };
  }

  const nextOrderStatus = decision === "RESOLVED_BUYER" ? "REFUNDED" : "COMPLETED";

  await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: decision,
        adminNotes: adminNotes.trim(),
        resolvedByAdminId: access.userId,
        resolvedAt: new Date(),
      },
    }),
    prisma.order.update({ where: { id: dispute.orderId }, data: { status: nextOrderStatus } }),
    prisma.orderStatusEvent.create({
      data: { orderId: dispute.orderId, status: nextOrderStatus, note: `Dispute resolved: ${decision.replace("_", " ").toLowerCase()}` },
    }),
  ]);

  const order = await prisma.order.findUnique({
    where: { id: dispute.orderId },
    select: { buyerId: true, store: { select: { business: { select: { id: true, userId: true } } } } },
  });
  if (order) {
    // Dispute resolution feeds the "complaints" Trust Score factor
    // (upheld-complaint rate) and, via nextOrderStatus above, potentially
    // the refund-rate factor too.
    await recomputeAndPersistTrustScore(order.store.business.id);
    const notifyBoth = [order.buyerId, order.store.business.userId];
    await prisma.notification
      .createMany({
        data: notifyBoth.map((userId) => ({
          userId,
          type: "DISPUTE",
          title: "Your dispute has been resolved",
          body: `Order #${dispute.orderId.slice(-8).toUpperCase()}: ${adminNotes.trim().slice(0, 140)}`,
        })),
      })
      .catch(() => {});
  }

  await prisma.auditLog.create({
    data: {
      userId: access.userId,
      action: "DISPUTE_RESOLVED",
      entity: "Dispute",
      entityId: disputeId,
      metadata: { decision, adminNotes: adminNotes.trim() },
    },
  });

  revalidatePath("/supaadmin/disputes");
  revalidatePath(`/supaadmin/disputes/${disputeId}`);
  revalidatePath(`/disputes/${dispute.orderId}`);
  return { success: true, data: undefined };
}
