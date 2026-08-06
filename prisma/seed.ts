import { PrismaClient, type Prisma } from "@prisma/client";
import { NICHE_NAMES, generateNicheVariations, LUMINA } from "../lib/template-themes";
import { fetchDemoPhoto } from "../lib/demo-images";

const prisma = new PrismaClient();

const PRODUCT_CATEGORIES = [
  "Fashion", "Beauty", "Electronics", "Phones", "Computers", "Food",
  "Groceries", "Furniture", "Home Appliances", "Jewelry", "Books", "Sports",
  "Baby Products", "Automotive", "Health", "Agriculture", "Construction",
  "Pets", "Office Supplies", "Art", "Music", "Gaming", "Toys",
  "Collectibles", "Industrial Equipment",
];

const SERVICE_CATEGORIES = [
  "Graphic Design", "Logo Design", "Branding", "Photography", "Videography",
  "Animation", "Video Editing", "Digital Marketing", "Social Media Management",
  "Website Design", "Software Development", "Mobile App Development",
  "UI/UX Design", "Writing", "Translation", "Virtual Assistant", "Accounting",
  "Legal Services", "Architecture", "Engineering", "Electrical Services",
  "Mechanical Services", "Plumbing", "Carpentry", "Tailoring",
  "Fashion Design", "Hair Styling", "Makeup", "Spa", "Cleaning", "Laundry",
  "Catering", "Chef Services", "Restaurant Services", "Event Planning", "DJ",
  "MC", "Hypeman", "Music Production", "Real Estate", "Interior Design",
  "Tutoring", "Healthcare", "Fitness", "Security Services", "Travel",
  "Logistics", "Courier", "Automobile Repairs", "Mechanics", "Painting",
  "Printing", "Photography Studio Rental", "Hotel Services",
];

// Pricing tiers. "Free" stays as the entry tier for new vendors — the three
// named paid tiers below are what's actually being sold. commissionRate and
// product/service caps step down as price goes up; customDomain unlocks at
// Enterprise and above. -1 in features means unlimited.
// templateTier: 1=Free, 2=Entrepreneur, 3=Enterprise, 4=Business Mogul.
// A store can pick any StoreTemplate whose tierRank <= its plan's templateTier
// — matches TIER_RANK in lib/template-themes.ts, keep both in sync.
const SUBSCRIPTIONS = [
  { name: "Free", price: 0, interval: "MONTHLY", commissionRate: 8, features: { products: 20, services: 10, customDomain: false, templateTier: 1 } },
  { name: "Entrepreneur", price: 35000, interval: "MONTHLY", commissionRate: 5, features: { products: 300, services: 150, customDomain: false, templateTier: 2 } },
  { name: "Enterprise", price: 67000, interval: "MONTHLY", commissionRate: 3, features: { products: 3000, services: 1500, customDomain: true, templateTier: 3 } },
  { name: "Business Mogul", price: 139000, interval: "MONTHLY", commissionRate: 1, features: { products: -1, services: -1, customDomain: true, templateTier: 4 } },
];
const ACTIVE_SUBSCRIPTION_NAMES = SUBSCRIPTIONS.map((s) => s.name);

async function main() {
  await prisma.category.createMany({
    data: PRODUCT_CATEGORIES.map((name) => ({ name, type: "PRODUCT" as const })),
    skipDuplicates: true,
  });
  await prisma.category.createMany({
    data: SERVICE_CATEGORIES.map((name) => ({ name, type: "SERVICE" as const })),
    skipDuplicates: true,
  });

  // 23 full niche templates. Each stores its real section composition,
  // catalog label, and hero style — not just a name — so the storefront
  // renderer (lib/template-themes.ts + app/store/[slug]/page.tsx) has
  // everything it needs even before falling back to the code-side table.
  // 12-18 real, distinct templates per niche (see lib/template-themes.ts
  // for the generation formula — color mode x accent x hero layout, never
  // just a recolor). Every generated template is its own StoreTemplate row,
  // with the full resolved theme stored in config so the storefront never
  // needs to re-derive it from category name alone.
  const allVariationNames: string[] = [];
  for (const name of NICHE_NAMES) {
    const variations = generateNicheVariations(name);
    // One real photo per niche, reused across all its variations — not one
    // per variation, which would mean 300+ API calls on every seed run for
    // no real benefit (the color/layout already differs; the category
    // photo doesn't need to). This is what actually shows up in the
    // template gallery's preview cards instead of a placeholder circle.
    const previewUrl = await fetchDemoPhoto(name);
    for (const [idx, v] of variations.entries()) {
      const templateName = `${name} — #${idx + 1} (${v.variationName})`;
      allVariationNames.push(templateName);
      await prisma.storeTemplate.upsert({
        where: { name: templateName },
        update: { category: name, isActive: true, tierRank: v.tierRank, previewUrl, config: v as unknown as Prisma.InputJsonValue },
        create: { name: templateName, category: name, tierRank: v.tierRank, previewUrl, config: v as unknown as Prisma.InputJsonValue },
      });
    }
  }

  // Retire any templates from an older seed run (the old 1-per-niche set,
  // or any prior naming scheme) that aren't part of the current generated
  // set — deactivate rather than delete, since a store might still
  // reference one (Store.templateId). Deactivated templates stop showing
  // in the gallery but existing stores using them keep working.
  await prisma.storeTemplate.updateMany({
    where: { name: { notIn: allVariationNames } },
    data: { isActive: false },
  });

  // Design-system backfill: force EVERY StoreTemplate row — including ones
  // just retired above — onto the current Lumina color/font tokens, without
  // touching the layout/copy fields already baked into its config. This is
  // what actually makes a palette/typeface change like Lumina show up on
  // already-provisioned stores. The upsert above only touches rows whose
  // generated `name` matches exactly; a stable-across-releases string (this
  // one includes the variation label), so a naming-scheme change — like the
  // one that introduced Lumina — creates new rows instead of updating old
  // ones, leaving every existing store's Store.templateId pointed at a
  // stale row with the old palette. This loop is what actually fixes that:
  // it patches every row by id, so it doesn't matter whether a store is on
  // a freshly upserted row or one from three seed runs ago.
  const allTemplates = await prisma.storeTemplate.findMany({ select: { id: true, config: true } });
  for (const t of allTemplates) {
    const config = t.config as Record<string, unknown> | null;
    if (!config) continue;
    await prisma.storeTemplate.update({
      where: { id: t.id },
      data: {
        config: {
          ...config,
          bg: LUMINA.bg,
          ink: LUMINA.ink,
          card: LUMINA.card,
          accent: LUMINA.accent,
          font: LUMINA.font,
          headlineFont: LUMINA.headlineFont,
          radius: LUMINA.radius,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  for (const sub of SUBSCRIPTIONS) {
    await prisma.subscription.upsert({
      where: { name: sub.name },
      update: { price: sub.price, commissionRate: sub.commissionRate, features: sub.features, isActive: true },
      create: sub,
    });
  }

  // Retire old plan names (e.g. the previous Starter/Growth/Pro) rather than
  // delete — a store may still reference one via subscriptionId, which has
  // no cascading delete. Deactivated plans disappear from pricing/upgrade
  // UI but keep working for whoever's already on one.
  await prisma.subscription.updateMany({
    where: { name: { notIn: ACTIVE_SUBSCRIPTION_NAMES } },
    data: { isActive: false },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
