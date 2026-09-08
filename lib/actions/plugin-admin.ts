"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { ensureSystemPlugins } from "@/lib/plugins";
import type { ActionResult } from "@/types/actions";

async function assertPlatform() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!(await verifyAdminToken(token))) return { success: false as const, error: "Admin PIN session expired or invalid." };
  return { success: true as const };
}

export async function getPluginAdminData() {
  const access = await assertPlatform();
  if (!access.success) return null;
  await ensureSystemPlugins();
  const [plugins, plans] = await Promise.all([
    prisma.plugin.findMany({ include: { planAccess: { include: { subscription: { select: { id: true, name: true } } } }, _count: { select: { stores: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.subscription.findMany({ where: { isActive: true }, orderBy: { price: "asc" }, select: { id: true, name: true, price: true } }),
  ]);
  return {
    plugins: plugins.map((p) => ({ id: p.id, key: p.key, name: p.name, description: p.description, category: p.category, icon: p.icon, price: Number(p.price), currency: p.currency, billingInterval: p.billingInterval, isFree: p.isFree, isComingSoon: p.isComingSoon, status: p.status, eligibleBusinessTypes: Array.isArray(p.eligibleBusinessTypes) ? p.eligibleBusinessTypes.filter((x): x is string => typeof x === "string") : ["*"], supportedPlanIds: p.planAccess.filter((x) => x.enabled).map((x) => x.subscription.id), supportedPlans: p.planAccess.filter((x) => x.enabled).map((x) => x.subscription.name), installedStores: p._count.stores })),
    plans: plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) })),
  };
}

export async function updatePluginConfiguration(input: { pluginId: string; price: number; isFree: boolean; isComingSoon: boolean; status: "ACTIVE" | "DISABLED"; billingInterval: "MONTHLY" | "YEARLY" | "ONE_TIME"; category: string; eligibleBusinessTypes: string[]; planIds: string[] }): Promise<ActionResult> {
  const access = await assertPlatform();
  if (!access.success) return access;
  if (!Number.isFinite(input.price) || input.price < 0) return { success: false, error: "Price cannot be negative." };
  if (!input.category.trim()) return { success: false, error: "Category is required." };
  const plugin = await prisma.plugin.findUnique({ where: { id: input.pluginId } });
  if (!plugin) return { success: false, error: "Plugin not found." };

  await prisma.$transaction(async (tx) => {
    await tx.plugin.update({ where: { id: input.pluginId }, data: { price: input.isFree ? 0 : input.price, isFree: input.isFree, isComingSoon: input.isComingSoon, status: input.status, billingInterval: input.billingInterval, category: input.category.trim(), eligibleBusinessTypes: input.eligibleBusinessTypes.length ? input.eligibleBusinessTypes : ["*"] } });
    await tx.pluginPlanAccess.updateMany({ where: { pluginId: input.pluginId }, data: { enabled: false } });
    if (input.planIds.length) {
      await tx.pluginPlanAccess.createMany({ data: input.planIds.map((subscriptionId) => ({ pluginId: input.pluginId, subscriptionId, enabled: true })), skipDuplicates: true });
    }
  });

  await prisma.auditLog.create({ data: { action: "PLUGIN_CONFIGURATION_UPDATED", entity: "Plugin", entityId: input.pluginId, metadata: { price: input.isFree ? 0 : input.price, isFree: input.isFree, planIds: input.planIds } } });
  revalidatePath("/supaadmin/apps");
  revalidatePath("/store/[slug]/admin/apps", "page");
  return { success: true, data: undefined };
}
