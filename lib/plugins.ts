import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export type PluginSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  price: number;
  billingInterval?: "MONTHLY" | "YEARLY" | "ONE_TIME";
  isFree?: boolean;
  isComingSoon?: boolean;
  eligibleBusinessTypes?: string[];
  sortOrder: number;
  plans: string[];
};

export const PLUGIN_CATALOG: PluginSeed[] = [
  {
    key: "pms",
    name: "BizNest PMS",
    description: "Property management for hotels and lodging businesses: rooms, reservations, front desk, housekeeping and guest billing.",
    category: "Hospitality",
    icon: "Hotel",
    price: 0,
    isFree: true,
    eligibleBusinessTypes: ["Hotel & Lodging"],
    sortOrder: 10,
    plans: ["Business Mogul"],
  },
  {
    key: "financial-control",
    name: "Financial Control",
    description: "A professional finance workspace for accountants, financial controllers and auditors, with double-entry journals, expenses, periods and reports.",
    category: "Finance",
    icon: "Calculator",
    price: 25000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 20,
    plans: ["Growth Store", "Business Mogul"],
  },
  {
    key: "crm",
    name: "CRM & Sales",
    description: "Lead management, customer pipeline, follow-ups and sales activity in one workspace.",
    category: "Sales",
    icon: "Users",
    price: 12000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 30,
    plans: ["Growth Store", "Business Mogul"],
  },
  {
    key: "seo",
    name: "SEO & Search",
    description: "Manage search visibility, metadata, structured data, indexing and local SEO from one workspace.",
    category: "Marketing",
    icon: "Search",
    price: 8000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 31,
    plans: ["Growth Store", "Business Mogul"],
  },
  {
  key: "hr-payroll",
    name: "HR & Payroll",
    description: "Employee records, attendance, leave, payroll and workforce reporting.",
    category: "Operations",
    icon: "BriefcaseBusiness",
    price: 18000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 40,
    plans: ["Business Mogul"],
  },
  {
    key: "procurement",
    name: "Procurement & Vendors",
    description: "Purchase requests, approvals, vendor management, purchase orders and supplier performance.",
    category: "Operations",
    icon: "ClipboardList",
    price: 15000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 50,
    plans: ["Business Mogul"],
  },
  {
    key: "advanced-analytics",
    name: "Advanced Analytics",
    description: "Deeper business intelligence, KPI dashboards and operational reporting across BizNest.",
    category: "Analytics",
    icon: "BarChart3",
    price: 10000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 60,
    plans: ["Growth Store", "Business Mogul"],
  },
  {
    key: "restaurant-operations",
    name: "Restaurant Operations",
    description: "Tables, kitchen operations, recipes, food cost and restaurant-specific workflows.",
    category: "Industry",
    icon: "ChefHat",
    price: 20000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["Restaurant"],
    sortOrder: 70,
    plans: ["Business Mogul"],
  },
  {
    key: "helpdesk",
    name: "Customer Support",
    description: "Tickets, assignments, response tracking, internal notes and customer support reporting.",
    category: "Customer",
    icon: "LifeBuoy",
    price: 9000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 80,
    plans: ["Business Mogul"],
  },
  {
    key: "asset-management",
    name: "Asset Management",
    description: "Track equipment, vehicles, property assets, depreciation schedules and maintenance history.",
    category: "Operations",
    icon: "Boxes",
    price: 12000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 90,
    plans: ["Business Mogul"],
  },
  {
    key: "legal-compliance",
    name: "Legal & Compliance",
    description: "Contracts, compliance tasks, document expiry and business risk registers.",
    category: "Professional",
    icon: "Scale",
    price: 15000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 100,
    plans: ["Business Mogul"],
  },
  {
    key: "fleet-management",
    name: "Fleet Management",
    description: "Vehicles, drivers, fuel, servicing, assignments and fleet cost tracking.",
    category: "Operations",
    icon: "Truck",
    price: 14000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["Logistics", "Courier", "Travel", "Construction"],
    sortOrder: 110,
    plans: ["Business Mogul"],
  },
  {
    key: "loyalty-rewards",
    name: "Loyalty & Rewards",
    description: "Customer points, tiers, rewards and retention campaigns.",
    category: "Growth",
    icon: "Gift",
    price: 7000,
    billingInterval: "MONTHLY",
    eligibleBusinessTypes: ["*"],
    sortOrder: 120,
    plans: ["Growth Store", "Business Mogul"],
  },
];

export async function ensureSystemPlugins() {
  // This function runs on app/plugin page loads, so it must stay cheap.
  // The old implementation performed a sequential upsert for every plugin
  // plus a plan lookup/upsert for every supported plan. That created dozens
  // of database round trips before the page could render.
  const keys = PLUGIN_CATALOG.map((seed) => seed.key);
  const existing = await prisma.plugin.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const existingKeys = new Set(existing.map((plugin) => plugin.key));
  const missing = PLUGIN_CATALOG.filter((seed) => !existingKeys.has(seed.key));

  if (missing.length) {
    await prisma.plugin.createMany({
      data: missing.map((seed) => ({
        id: nanoid(24),
        key: seed.key,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        icon: seed.icon,
        price: seed.price,
        billingInterval: seed.billingInterval ?? "MONTHLY",
        isFree: seed.isFree ?? false,
        isComingSoon: seed.isComingSoon ?? false,
        status: "ACTIVE" as const,
        eligibleBusinessTypes: seed.eligibleBusinessTypes ?? ["*"],
        sortOrder: seed.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  // Re-read IDs once so we can create only genuinely missing plan-access
  // rows. Existing rows are never overwritten; SupaAdmin remains authoritative
  // for pricing, eligibility, status and plan decisions.
  const plugins = await prisma.plugin.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const pluginIds = plugins.map((plugin) => plugin.id);
  const planNames = [...new Set(PLUGIN_CATALOG.flatMap((seed) => seed.plans))];

  if (!pluginIds.length || !planNames.length) return;

  const [plans, existingAccess] = await Promise.all([
    prisma.subscription.findMany({
      where: { name: { in: planNames } },
      select: { id: true, name: true },
    }),
    prisma.pluginPlanAccess.findMany({
      where: { pluginId: { in: pluginIds } },
      select: { pluginId: true, subscriptionId: true },
    }),
  ]);

  const pluginByKey = new Map(plugins.map((plugin) => [plugin.key, plugin.id]));
  const planByName = new Map(plans.map((plan) => [plan.name, plan.id]));
  const existingAccessKeys = new Set(existingAccess.map((row) => `${row.pluginId}:${row.subscriptionId}`));
  const accessRows: Array<{ pluginId: string; subscriptionId: string; enabled: boolean }> = [];

  for (const seed of PLUGIN_CATALOG) {
    const pluginId = pluginByKey.get(seed.key);
    if (!pluginId) continue;
    for (const planName of seed.plans) {
      const subscriptionId = planByName.get(planName);
      if (!subscriptionId) continue;
      const key = `${pluginId}:${subscriptionId}`;
      if (!existingAccessKeys.has(key)) {
        accessRows.push({ pluginId, subscriptionId, enabled: true });
      }
    }
  }

  if (accessRows.length) {
    await prisma.pluginPlanAccess.createMany({ data: accessRows, skipDuplicates: true });
  }
}

function eligibleForBusiness(plugin: { eligibleBusinessTypes: unknown }, businessType: string) {
  const values = Array.isArray(plugin.eligibleBusinessTypes)
    ? plugin.eligibleBusinessTypes.filter((v): v is string => typeof v === "string")
    : ["*"];
  return values.includes("*") || values.includes(businessType);
}

export async function getPluginEntitlement(storeId: string, pluginKey: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      businessType: true,
      subscriptionId: true,
      subscription: { select: { id: true, name: true } },
      installedPlugins: { where: { plugin: { key: pluginKey }, status: "ACTIVE" }, select: { id: true, status: true } },
    },
  });
  if (!store) return { allowed: false as const, reason: "Store not found." };

  const plugin = await prisma.plugin.findUnique({
    where: { key: pluginKey },
    include: { planAccess: true },
  });
  if (!plugin || plugin.status !== "ACTIVE") return { allowed: false as const, reason: "This app is not available." };
  if (!eligibleForBusiness(plugin, store.businessType)) {
    return { allowed: false as const, reason: "This app is not available for this business type." };
  }

  const planAllowed = plugin.isFree || plugin.planAccess.some((p) => p.subscriptionId === store.subscriptionId && p.enabled);
  if (!planAllowed) {
    const supportedPlans = await prisma.pluginPlanAccess.findMany({
      where: { pluginId: plugin.id, enabled: true },
      include: { subscription: { select: { name: true } } },
      orderBy: { subscription: { price: "asc" } },
    });
    return {
      allowed: false as const,
      reason: `Upgrade required. ${plugin.name} is available on ${supportedPlans.map((p) => p.subscription.name).join(" or ") || "a supported plan"}.`,
      plugin,
      supportedPlans: supportedPlans.map((p) => p.subscription.name),
    };
  }

  let installed = store.installedPlugins.length > 0;
  // PMS predates the marketplace. Existing hotel stores on its supported
  // plan must not be locked out simply because they were never backfilled
  // with a StorePlugin row. Backfill that legacy entitlement once, while
  // keeping every newer app explicitly installable.
  if (!installed && pluginKey === "pms") {
    await prisma.storePlugin.upsert({
      where: { storeId_pluginId: { storeId: store.id, pluginId: plugin.id } },
      update: { status: "ACTIVE" },
      create: { storeId: store.id, pluginId: plugin.id, status: "ACTIVE" },
    });
    installed = true;
  }

  return { allowed: true as const, plugin, installed, subscriptionName: store.subscription?.name ?? null };
}
