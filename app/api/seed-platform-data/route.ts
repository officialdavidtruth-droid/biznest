import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { NICHE_NAMES, generateNicheVariations } from "@/lib/template-themes";
import { fetchDemoPhoto } from "@/lib/demo-images";
import type { Prisma } from "@prisma/client";

// Mirrors prisma/seed.ts exactly (categories, generated niche template
// variations with real theme configs, subscription tiers) so it can be run
// over HTTP against production with no local terminal/DB access needed.
// Keep in sync with prisma/seed.ts if that file changes — this is the only
// way to (re)seed production as things currently stand. Safe to call more
// than once: everything is upsert/createMany+skipDuplicates.
export const maxDuration = 60;

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

const SUBSCRIPTIONS = [
  { name: "Free", price: 0, interval: "MONTHLY", commissionRate: 8, features: { products: 20, services: 10, customDomain: false, templateTier: 1 } },
  { name: "Entrepreneur", price: 35000, interval: "MONTHLY", commissionRate: 5, features: { products: 300, services: 150, customDomain: false, templateTier: 2 } },
  { name: "Enterprise", price: 67000, interval: "MONTHLY", commissionRate: 3, features: { products: 3000, services: 1500, customDomain: true, templateTier: 3 } },
  { name: "Business Mogul", price: 139000, interval: "MONTHLY", commissionRate: 1, features: { products: -1, services: -1, customDomain: true, templateTier: 4 } },
];
const ACTIVE_SUBSCRIPTION_NAMES = SUBSCRIPTIONS.map((s) => s.name);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return NextResponse.json({ success: false, message: "Invalid or missing secret." }, { status: 403 });
  }

  await prisma.category.createMany({
    data: PRODUCT_CATEGORIES.map((name) => ({ name, type: "PRODUCT" as const })),
    skipDuplicates: true,
  });
  await prisma.category.createMany({
    data: SERVICE_CATEGORIES.map((name) => ({ name, type: "SERVICE" as const })),
    skipDuplicates: true,
  });

  const allVariationNames: string[] = [];
  for (const name of NICHE_NAMES) {
    const variations = generateNicheVariations(name);
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

  await prisma.storeTemplate.updateMany({
    where: { name: { notIn: allVariationNames } },
    data: { isActive: false },
  });

  for (const sub of SUBSCRIPTIONS) {
    await prisma.subscription.upsert({
      where: { name: sub.name },
      update: { price: sub.price, commissionRate: sub.commissionRate, features: sub.features, isActive: true },
      create: sub,
    });
  }
  await prisma.subscription.updateMany({
    where: { name: { notIn: ACTIVE_SUBSCRIPTION_NAMES } },
    data: { isActive: false },
  });

  const counts = {
    categories: await prisma.category.count(),
    activeTemplates: await prisma.storeTemplate.count({ where: { isActive: true } }),
    subscriptions: await prisma.subscription.count({ where: { isActive: true } }),
    niches: NICHE_NAMES.length,
  };

  return NextResponse.json({ success: true, message: "Platform data seeded.", counts });
}
