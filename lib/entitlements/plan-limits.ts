/**
 * Plan-based limits beyond product/service counts. Stored in Subscription.features; when a key is missing the
 * default follows the plan's templateTier (the entry plan is tier 2), so no database change is needed.
 * A plan with no templateTier at all (legacy or misconfigured) fails open, like the product caps do.
 *
 *   staff:       staff accounts a store may have (-1 = unlimited). Default: tier <=2 -> 2, tier 3 -> 5, else 20.
 *   growthTools: abandoned-checkout recovery, automations, referrals, report builder. Default: tier 3 and up.
 */
export type PlanFeatures = { templateTier?: number; staff?: number; growthTools?: boolean } | null | undefined;

const tierOf = (f: PlanFeatures): number | null => (typeof f?.templateTier === "number" ? f.templateTier : null);

export function staffLimitFor(f: PlanFeatures): number {
  if (typeof f?.staff === "number") return f.staff;
  const tier = tierOf(f);
  if (tier === null) return 20;
  if (tier <= 2) return 2;
  if (tier === 3) return 5;
  return 20;
}

export function growthToolsAllowed(f: PlanFeatures): boolean {
  if (typeof f?.growthTools === "boolean") return f.growthTools;
  const tier = tierOf(f);
  return tier === null || tier >= 3;
}

