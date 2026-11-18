/**
 * Plan-based limits beyond product/service counts. Stored in Subscription.features; when a key is missing the
 * default follows the plan's templateTier (the entry plan is tier 2), so no database change is needed.
 * A plan with no templateTier at all (legacy or misconfigured) fails open, like the product caps do.
 *
 * Plans map to three ranks by templateTier: 1 = Starters, 2 = Entrepreneurship, 3 and up = Business Mogul.
 *
 *   staff:       staff accounts a store may have (-1 = unlimited). Default: Starters 1, Entrepreneurship 3, Mogul 20.
 *   growthTools: abandoned-checkout recovery, automations, referrals, report builder. Default: Mogul.
 *   capabilities: see PLAN_CAPABILITIES for the rank each dashboard tool starts at.
 */
export type PlanFeatures = { templateTier?: number; staff?: number; growthTools?: boolean } | null | undefined;

const tierOf = (f: PlanFeatures): number | null => (typeof f?.templateTier === "number" ? f.templateTier : null);

/**
 * 1 = Starters, 2 = Entrepreneurship, 3 = Business Mogul. The plan's name decides when it is one of the three
 * (the stored templateTier numbers have drifted on the live database); otherwise the templateTier does, and
 * null (fails open) when the plan has neither.
 */
export function planRankOf(f: PlanFeatures, name?: string | null): 1 | 2 | 3 | null {
  if (name) {
    if (/mogul/i.test(name)) return 3;
    if (/entrepreneur/i.test(name)) return 2;
    if (/starter/i.test(name)) return 1;
  }
  const tier = tierOf(f);
  if (tier === null) return null;
  return tier <= 1 ? 1 : tier === 2 ? 2 : 3;
}

export function staffLimitFor(f: PlanFeatures, name?: string | null): number {
  if (typeof f?.staff === "number") return f.staff;
  const rank = planRankOf(f, name);
  if (rank === null) return 20;
  return rank === 1 ? 1 : rank === 2 ? 3 : 20;
}

/** The lowest plan rank each plan-limited dashboard tool is open to. Everything not listed is open to every plan. */
export const PLAN_CAPABILITIES = {
  pos: 2,
  invoices: 2,
  quotes: 2,
  coupons: 2,
  giftCards: 2,
  ads: 3,
  webhooks: 3,
} as const;
export type PlanCapability = keyof typeof PLAN_CAPABILITIES;

const RANK_NAME = { 1: "Starters", 2: "Entrepreneurship", 3: "Business Mogul" } as const;

export function planAllows(f: PlanFeatures, capability: PlanCapability, name?: string | null): boolean {
  const rank = planRankOf(f, name);
  return rank === null || rank >= PLAN_CAPABILITIES[capability];
}

/** "Entrepreneurship" or "Business Mogul": the cheapest plan that includes the capability. */
export function minPlanNameFor(capability: PlanCapability): string {
  return RANK_NAME[PLAN_CAPABILITIES[capability]];
}

export function growthToolsAllowed(f: PlanFeatures, name?: string | null): boolean {
  if (typeof f?.growthTools === "boolean") return f.growthTools;
  const rank = planRankOf(f, name);
  return rank === null || rank >= 3;
}

