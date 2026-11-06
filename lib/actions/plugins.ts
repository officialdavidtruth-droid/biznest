"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { canManageBillingAndStaff, getStoreAccessRole } from "@/lib/access/store-access";
import { billingCallbackUrl, chargeCustomer, PLATFORM_BILLING_GATEWAY } from "@/lib/payments/gateway";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import type { ActionResult } from "@/types/actions";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { ensureSystemPlugins, getPluginEntitlement } from "@/lib/plugins";

export async function getStoreApps(slug: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return null;
  await ensureSystemPlugins();

  const [plugins, plans] = await Promise.all([
    prisma.plugin.findMany({
      where: { status: "ACTIVE" },
      include: {
        planAccess: { where: { enabled: true }, include: { subscription: { select: { name: true, price: true } } } },
        stores: { where: { storeId: access.store.id }, select: { status: true, renewsAt: true } },
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
      const planAllowed = plugin.planAccess.length > 0
        ? plugin.planAccess.some((p) => p.subscriptionId === access.store.subscriptionId)
        : plugin.isFree;
      const installed = plugin.stores[0]?.status === "ACTIVE";
      // Paid recurring apps are renewed by the owner (one-off Korapay payment, no saved card):
      // offer "Renew" in the last 7 days before the app expires.
      const renewsAt = plugin.stores[0]?.renewsAt ?? null;
      const renewalDue = installed && !plugin.isFree && plugin.billingInterval !== "ONE_TIME" && !!renewsAt && renewsAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
      return {
        renewalDue,
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
  if (entitlement.plugin.isComingSoon) return { success: false, error: "This app is coming soon and can't be installed yet." };
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

export async function startPluginPurchase(slug: string, pluginKey: string, options: { renew?: boolean } = {}): Promise<ActionResult<{ authorizationUrl: string }>> {
  const access = await assertOwner(slug);
  if (!access.success) return access;
  await ensureSystemPlugins();
  const entitlement = await getPluginEntitlement(access.store.id, pluginKey);
  if (!entitlement.allowed) return { success: false, error: entitlement.reason };
  if (entitlement.plugin.isComingSoon) return { success: false, error: "This app is coming soon and can't be purchased yet." };
  if (entitlement.plugin.isFree) return { success: false, error: "This app is free; install it directly." };
  if (Number(entitlement.plugin.price) <= 0) return { success: false, error: "This app does not have a valid price configured." };
  if (entitlement.installed && !options.renew) return { success: false, error: "This app is already installed." };
  if (options.renew && !entitlement.installed) return { success: false, error: "Install this app first." };

  // A renewal leaves the running app ACTIVE; a first purchase holds it SUSPENDED until the payment lands.
  const pending = options.renew
    ? await prisma.storePlugin.findUniqueOrThrow({ where: { storeId_pluginId: { storeId: access.store.id, pluginId: entitlement.plugin.id } } })
    : await prisma.storePlugin.upsert({
        where: { storeId_pluginId: { storeId: access.store.id, pluginId: entitlement.plugin.id } },
        update: { status: "SUSPENDED" },
        create: { storeId: access.store.id, pluginId: entitlement.plugin.id, status: "SUSPENDED" },
      });

  const reference = `PLUG-${access.store.id}-${entitlement.plugin.id}-${nanoid(8)}`;
  await createPendingPayment({ storeId: access.store.id, purpose: "PLUGIN_PURCHASE", provider: PLATFORM_BILLING_GATEWAY, reference, amount: entitlement.plugin.price, currency: entitlement.plugin.currency });
  const session = await auth();
  const charge = await chargeCustomer({
    email: session?.user?.email ?? `${access.store.slug}@biznest.space`,
    amountNaira: Number(entitlement.plugin.price),
    reference,
    callbackUrl: billingCallbackUrl("plugin", { slug }),
    gateway: PLATFORM_BILLING_GATEWAY,
  });
  if (!charge.success) {
    await markPaymentFailed(reference);
    if (!options.renew) await prisma.storePlugin.update({ where: { id: pending.id }, data: { status: "SUSPENDED" } });
    return { success: false, error: charge.error };
  }

  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway } });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

