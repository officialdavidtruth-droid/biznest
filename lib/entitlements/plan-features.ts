import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

import { growthToolsAllowed, minPlanNameFor, planAllows, type PlanCapability, type PlanFeatures } from "@/lib/entitlements/plan-limits";

export { growthToolsAllowed, staffLimitFor, planAllows, PLAN_CAPABILITIES, type PlanCapability, type PlanFeatures } from "@/lib/entitlements/plan-limits";

export type PlanGate = { ok: true } | { ok: false; message: string };

/** For dashboard pages: owner and staff of a store on a plan without growth tools see an upgrade notice instead. */
export async function growthToolsGate(slug: string, toolName: string): Promise<PlanGate> {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "PLATFORM_ADMIN" || role === "SUPPORT_MODERATOR") return { ok: true };
  const store = await prisma.store.findUnique({ where: { slug }, select: { subscription: { select: { name: true, features: true } } } });
  if (!store?.subscription) return { ok: true }; // the dashboard's own plan gate handles stores with no plan
  if (growthToolsAllowed(store.subscription.features as PlanFeatures, store.subscription.name)) return { ok: true };
  return { ok: false, message: `${toolName} isn't part of the ${store.subscription.name} plan. Upgrade your plan to use it.` };
}

const CAPABILITY_LABEL: Record<PlanCapability, string> = {
  pos: "Point of Sale",
  invoices: "Invoices",
  quotes: "Quotes",
  coupons: "Coupons",
  giftCards: "Gift cards",
  ads: "Ads",
  webhooks: "Webhooks",
};

/**
 * Plan check for a dashboard tool that only some plans include. Pass the store's slug (pages) or id (server
 * actions). Platform staff are never blocked; a store with no plan is left to the dashboard's own plan gate.
 */
export async function planGate(where: { slug: string } | { storeId: string }, capability: PlanCapability): Promise<PlanGate> {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "PLATFORM_ADMIN" || role === "SUPPORT_MODERATOR") return { ok: true };
  const store = await prisma.store.findUnique({
    where: "slug" in where ? { slug: where.slug } : { id: where.storeId },
    select: { subscription: { select: { name: true, features: true } } },
  });
  if (!store?.subscription) return { ok: true };
  if (planAllows(store.subscription.features as PlanFeatures, capability, store.subscription.name)) return { ok: true };
  return { ok: false, message: `${CAPABILITY_LABEL[capability]} isn't part of the ${store.subscription.name} plan. Upgrade to ${minPlanNameFor(capability)} or above to use it.` };
}
