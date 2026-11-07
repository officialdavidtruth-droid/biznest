import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

import { growthToolsAllowed, type PlanFeatures } from "@/lib/entitlements/plan-limits";

export { growthToolsAllowed, staffLimitFor, type PlanFeatures } from "@/lib/entitlements/plan-limits";

export type PlanGate = { ok: true } | { ok: false; message: string };

/** For dashboard pages: owner and staff of a store on a plan without growth tools see an upgrade notice instead. */
export async function growthToolsGate(slug: string, toolName: string): Promise<PlanGate> {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "PLATFORM_ADMIN" || role === "SUPPORT_MODERATOR") return { ok: true };
  const store = await prisma.store.findUnique({ where: { slug }, select: { subscription: { select: { name: true, features: true } } } });
  if (!store?.subscription) return { ok: true }; // the dashboard's own plan gate handles stores with no plan
  if (growthToolsAllowed(store.subscription.features as PlanFeatures)) return { ok: true };
  return { ok: false, message: `${toolName} isn't part of the ${store.subscription.name} plan. Upgrade your plan to use it.` };
}
