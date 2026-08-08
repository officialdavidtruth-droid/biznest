import { PrismaClient, type Prisma } from "@prisma/client";
import { generateNicheVariations, TEMPLATE_NAME, generateHeenzyVariation, TEMPLATE_NAME_HEENZY, generateNovaVariation, TEMPLATE_NAME_NOVA } from "../lib/template-themes";
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

  // The platform ships three storefront templates — "Fresh & Co.",
  // "Heenzy Sneaker Co.", and "Nova Studio" (see lib/template-themes.ts).
  // Every store picks one of these designs from the Template Gallery.
  const [freshTemplate] = generateNicheVariations("Fresh & Co.");
  const previewUrl = await fetchDemoPhoto("Fresh & Co.");
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME },
    update: { category: TEMPLATE_NAME, isActive: true, tierRank: freshTemplate.tierRank, previewUrl, config: freshTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME, category: TEMPLATE_NAME, tierRank: freshTemplate.tierRank, previewUrl, config: freshTemplate as unknown as Prisma.InputJsonValue },
  });

  const heenzyTemplate = generateHeenzyVariation();
  const heenzyPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_HEENZY);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_HEENZY },
    update: { category: TEMPLATE_NAME_HEENZY, isActive: true, tierRank: heenzyTemplate.tierRank, previewUrl: heenzyPreviewUrl, config: heenzyTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_HEENZY, category: TEMPLATE_NAME_HEENZY, tierRank: heenzyTemplate.tierRank, previewUrl: heenzyPreviewUrl, config: heenzyTemplate as unknown as Prisma.InputJsonValue },
  });

  const novaTemplate = generateNovaVariation();
  const novaPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_NOVA);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_NOVA },
    update: { category: TEMPLATE_NAME_NOVA, isActive: true, tierRank: novaTemplate.tierRank, previewUrl: novaPreviewUrl, config: novaTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_NOVA, category: TEMPLATE_NAME_NOVA, tierRank: novaTemplate.tierRank, previewUrl: novaPreviewUrl, config: novaTemplate as unknown as Prisma.InputJsonValue },
  });

  // Retire every other template row (the old niche-generated set, or any
  // prior naming scheme) — deactivate rather than delete, since a store
  // might still reference one (Store.templateId). Deactivated templates
  // stop showing in the gallery but existing stores using them keep working.
  await prisma.storeTemplate.updateMany({
    where: { name: { notIn: [TEMPLATE_NAME, TEMPLATE_NAME_HEENZY, TEMPLATE_NAME_NOVA] } },
    data: { isActive: false },
  });

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
