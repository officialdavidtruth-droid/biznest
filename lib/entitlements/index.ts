import { prisma } from "@/lib/prisma";

export type EntitlementResource = "products" | "services";

export type EntitlementCheck =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * Enforces the Subscription.features product/service cap for a store.
 * -1 (or a missing key) in features means unlimited (Business Mogul).
 * Called from createProduct / createService before the row is written —
 * see lib/actions/product.ts and lib/actions/service.ts. Hard-blocks the
 * create once the store is at or over its plan's cap; existing rows over
 * a newly-lowered cap are left alone (no forced deletes), they just can't
 * add more until they upgrade or trim down.
 */
export async function assertUnderPlanLimit(
  storeId: string,
  resource: EntitlementResource
): Promise<EntitlementCheck> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { subscription: { select: { name: true, features: true } } },
  });

  if (!store?.subscription) {
    return {
      allowed: false,
      error: "Your store doesn't have an active plan. Choose a plan to continue.",
    };
  }

  const features = store.subscription.features as { products?: number; services?: number } | null;
  const limit = resource === "products" ? features?.products : features?.services;

  // Undefined/null (misconfigured plan) or -1 both mean unlimited — fail
  // open on missing config rather than blocking every store on a plan
  // whose features JSON hasn't been fully set up.
  if (limit === undefined || limit === null || limit === -1) {
    return { allowed: true };
  }

  const count =
    resource === "products"
      ? await prisma.product.count({ where: { storeId } })
      : await prisma.service.count({ where: { storeId } });

  if (count >= limit) {
    const label = resource === "products" ? "products" : "services";
    return {
      allowed: false,
      error: `You've reached your ${store.subscription.name} plan's limit of ${limit} ${label}. Upgrade your plan to add more.`,
    };
  }

  return { allowed: true };
}
