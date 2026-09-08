"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { canManageBillingAndStaff, getStoreAccessRole } from "@/lib/access/store-access";
import { chargeCustomer } from "@/lib/payments/gateway";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import type { ActionResult } from "@/types/actions";
import { ensureSystemPlugins, getPluginEntitlement } from "@/lib/plugins";
import { APP_URL } from "@/lib/constants/app-url";

export async function getStoreApps(slug: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return null;
  await ensureSystemPlugins();

  const [plugins, plans] = await Promise.all([
    prisma.plugin.findMany({
      where: { status: "ACTIVE" },
      include: {
        planAccess: { where: { enabled: true }, include: { subscription: { select: { name: true, price: true } } } },
        stores: { where: { storeId: access.store.id }, select: { status: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.subscription.findMany({ where: { isActive: true }, orderBy: { price: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    store: { name: access.store.name, businessType: access.store.businessType, subscriptionId: access.store.subscriptionId },
    plans,
    plugins: plugins.map((plugin) => {
      const eligible = Array.isArray(plugin.eligibleBusinessTypes)
        ? (plugin.eligibleBusinessTypes as unknown[]).some((v) => v === "*" || v === access.store.businessType)
        : true;
      const planAllowed = plugin.isFree || plugin.planAccess.some((p) => p.subscriptionId === access.store.subscriptionId);
      const installed = plugin.stores[0]?.status === "ACTIVE";
      return {
        id: plugin.id,
        key: plugin.key,
        name: plugin.name,
        description: plugin.description,
        category: plugin.category,
        icon: plugin.icon,
        price: Number(plugin.price),
        currency: plugin.currency,
        billingInterval: plugin.billingInterval,
        isFree: plugin.isFree,
        isComingSoon: plugin.isComingSoon,
        eligible,
        planAllowed,
        installed,
        supportedPlans: plugin.planAccess.map((p) => p.subscription.name),
      };
    }),
  };
}

async function assertOwner(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) return { success: false as const, error: "Only the business owner can install or purchase apps." };
  return { success: true as const, store, role };
}

export async function installFreePlugin(slug: string, pluginKey: string): Promise<ActionResult<{ installed: true }>> {
  const access = await assertOwner(slug);
  if (!access.success) return access;
  await ensureSystemPlugins();
  const entitlement = await getPluginEntitlement(access.store.id, pluginKey);
  if (!entitlement.allowed) return { success: false, error: entitlement.reason };
  if (!entitlement.plugin.isFree) return { success: false, error: "This app requires payment." };

  await prisma.storePlugin.upsert({
    where: { storeId_pluginId: { storeId: access.store.id, pluginId: entitlement.plugin.id } },
    update: { status: "ACTIVE" },
    create: { storeId: access.store.id, pluginId: entitlement.plugin.id, status: "ACTIVE" },
  });
  await prisma.auditLog.create({ data: { action: "PLUGIN_INSTALLED", entity: "Plugin", entityId: entitlement.plugin.id, metadata: { storeId: access.store.id, pluginKey } } });
  revalidatePath(`/store/${slug}/admin/apps`);
  return { success: true, data: { installed: true } };
}

export async function startPluginPurchase(slug: string, pluginKey: string): Promise<ActionResult<{ authorizationUrl: string }>> {
  const access = await assertOwner(slug);
  if (!access.success) return access;
  await ensureSystemPlugins();
  const entitlement = await getPluginEntitlement(access.store.id, pluginKey);
  if (!entitlement.allowed) return { success: false, error: entitlement.reason };
  if (entitlement.plugin.isFree) return { success: false, error: "This app is free; install it directly." };
  if (Number(entitlement.plugin.price) <= 0) return { success: false, error: "This app does not have a valid price configured." };
  if (entitlement.installed) return { success: false, error: "This app is already installed." };

  const pending = await prisma.storePlugin.upsert({
    where: { storeId_pluginId: { storeId: access.store.id, pluginId: entitlement.plugin.id } },
    update: { status: "SUSPENDED" },
    create: { storeId: access.store.id, pluginId: entitlement.plugin.id, status: "SUSPENDED" },
  });

  const reference = `PLUG-${access.store.id}-${entitlement.plugin.id}-${nanoid(8)}`;
  const session = await auth();
  const charge = await chargeCustomer({
    email: session?.user?.email ?? `${access.store.slug}@biznest.space`,
    amountNaira: Number(entitlement.plugin.price),
    reference,
    callbackUrl: `${APP_URL}/api/payments/paystack/plugin-callback?slug=${encodeURIComponent(slug)}`,
    gateway: "PAYSTACK",
  });
  if (!charge.success) {
    await prisma.storePlugin.update({ where: { id: pending.id }, data: { status: "SUSPENDED" } });
    return { success: false, error: charge.error };
  }

  await prisma.payment.create({
    data: {
      storeId: access.store.id,
      purpose: "PLUGIN_PURCHASE",
      provider: "PAYSTACK",
      reference,
      status: "PENDING",
      amount: entitlement.plugin.price,
      currency: entitlement.plugin.currency,
    },
  });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

export async function settlePluginPurchase(reference: string, amountNaira: number, rawPayload: object): Promise<ActionResult<{ slug: string; pluginKey: string }>> {
  if (!reference.startsWith("PLUG-")) return { success: false, error: "Invalid plugin payment reference." };
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment?.storeId || payment.purpose !== "PLUGIN_PURCHASE") return { success: false, error: "Plugin payment not found." };
  if (Math.abs(Number(payment.amount) - amountNaira) > 0.01) return { success: false, error: "Plugin payment amount mismatch." };

  const parts = reference.split("-");
  const storeId = parts[1];
  const pluginId = parts[2];
  if (storeId !== payment.storeId) return { success: false, error: "Invalid plugin payment." };

  const result = await prisma.$transaction(async (tx) => {
    const plugin = await tx.plugin.findUnique({ where: { id: pluginId }, select: { id: true, key: true, billingInterval: true, isFree: true, price: true } });
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, slug: true } });
    if (!plugin || !store) return { ok: false as const, error: "Plugin or store not found." };

    await tx.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: rawPayload as never, verifiedAt: new Date() },
    });
    const renewsAt = plugin.billingInterval === "MONTHLY" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : plugin.billingInterval === "YEARLY" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
    await tx.storePlugin.upsert({
      where: { storeId_pluginId: { storeId, pluginId } },
      update: { status: "ACTIVE", renewsAt, pastDueSince: null, lastPaymentAt: new Date() },
      create: { storeId, pluginId, status: "ACTIVE", renewsAt, lastPaymentAt: new Date() },
    });
    return { ok: true as const, slug: store.slug, pluginKey: plugin.key };
  });

  if (!result.ok) return { success: false, error: result.error };
  await prisma.auditLog.create({ data: { action: "PLUGIN_PAYMENT_COMPLETED", entity: "Plugin", entityId: pluginId, metadata: { storeId, reference, amountNaira } } });
  revalidatePath(`/store/${result.slug}/admin/apps`);
  return { success: true, data: { slug: result.slug, pluginKey: result.pluginKey } };
}
