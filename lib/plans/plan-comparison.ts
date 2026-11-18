import { PLAN_CAPABILITIES, planRankOf, staffLimitFor, type PlanFeatures } from "@/lib/entitlements/plan-limits";

/**
 * The plan comparison table shown on the landing page and the plan pickers. Every cell is computed from
 * the plan's own settings (limits, domain, tier) or from PLAN_CAPABILITIES, the same map the dashboard
 * enforces, so what the table promises can never drift from what a store actually gets.
 */
export type ComparablePlan = {
  id: string;
  name: string;
  price: number;
  commissionRate: number;
  features: unknown;
};

export type Cell = string | boolean;
export type ComparisonRow = { label: string; cells: Cell[] };
export type ComparisonGroup = { title: string; rows: ComparisonRow[] };

type Limits = PlanFeatures & { products?: number; services?: number; customDomain?: boolean };

/** Cheapest first; the rank is the plan's tier (1 Starters, 2 Entrepreneurship, 3 Business Mogul), falling back to its position. */
export function rankedPlans<T extends ComparablePlan>(plans: T[]): Array<T & { rank: 1 | 2 | 3 }> {
  const sorted = [...plans].sort((a, b) => a.price - b.price);
  return sorted.map((plan, index) => ({ ...plan, rank: planRankOf(plan.features as PlanFeatures) ?? (Math.min(index + 1, 3) as 1 | 2 | 3) }));
}

const count = (n: number | undefined) => (n === -1 ? "Unlimited" : String(n ?? 0));

export function buildComparison(plans: ComparablePlan[]): ComparisonGroup[] {
  const ranked = rankedPlans(plans);
  const each = (fn: (p: (typeof ranked)[number], f: Limits) => Cell): Cell[] => ranked.map((p) => fn(p, (p.features ?? {}) as Limits));
  const from = (cap: keyof typeof PLAN_CAPABILITIES) => each((p) => p.rank >= PLAN_CAPABILITIES[cap]);
  const always = () => each(() => true);

  return [
    {
      title: "Store size",
      rows: [
        { label: "Products", cells: each((_, f) => count(f.products)) },
        { label: "Services", cells: each((_, f) => count(f.services)) },
        { label: "Commission on your sales", cells: each((p) => (p.commissionRate === 0 ? "None" : `${p.commissionRate}%`)) },
        { label: "Staff accounts", cells: each((_, f) => count(staffLimitFor(f))) },
        { label: "Your own domain name", cells: each((_, f) => Boolean(f.customDomain)) },
      ],
    },
    {
      title: "Your website",
      rows: [
        { label: "Store designs", cells: each((p) => (p.rank === 1 ? "Starter designs" : p.rank === 2 ? "Starter + Entrepreneurship designs" : "Every design, including premium")) },
        { label: "Website builder with click-to-edit", cells: always() },
        { label: "Blog posts", cells: always() },
        { label: "Listing on BizNest Browse", cells: always() },
      ],
    },
    {
      title: "Selling",
      rows: [
        { label: "Orders, bookings and payments", cells: always() },
        { label: "Guest checkout and order tracking", cells: always() },
        { label: "Customer list and reviews", cells: always() },
        { label: "Point of Sale", cells: from("pos") },
        { label: "Invoices", cells: from("invoices") },
        { label: "Quotes", cells: from("quotes") },
        { label: "Coupons and gift cards", cells: from("coupons") },
      ],
    },
    {
      title: "Grow",
      rows: [
        { label: "Abandoned-checkout recovery", cells: each((p) => p.rank >= 3) },
        { label: "Automations", cells: each((p) => p.rank >= 3) },
        { label: "Referral program", cells: each((p) => p.rank >= 3) },
        { label: "Report builder", cells: each((p) => p.rank >= 3) },
        { label: "Ads on BizNest Browse", cells: from("ads") },
      ],
    },
    {
      title: "Business tools",
      rows: [
        { label: "Business apps (PMS, HR, CRM, FnB and more)", cells: each((p) => p.rank >= 2) },
        { label: "Webhooks", cells: from("webhooks") },
      ],
    },
  ];
}
