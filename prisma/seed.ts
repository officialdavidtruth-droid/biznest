import { PrismaClient } from "@prisma/client";
import { NICHE_TEMPLATES, NICHE_NAMES } from "../lib/template-themes";

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

const SUBSCRIPTIONS = [
  { name: "Free", price: 0, interval: "MONTHLY", commissionRate: 8, features: { products: 20, services: 10 } },
  { name: "Starter", price: 5000, interval: "MONTHLY", commissionRate: 5, features: { products: 200, services: 100 } },
  { name: "Growth", price: 15000, interval: "MONTHLY", commissionRate: 3, features: { products: 2000, services: 1000 } },
  { name: "Pro", price: 40000, interval: "MONTHLY", commissionRate: 1.5, features: { products: -1, services: -1 } },
];

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
  for (const name of NICHE_NAMES) {
    const t = NICHE_TEMPLATES[name];
    await prisma.storeTemplate.upsert({
      where: { name },
      update: {
        category: name,
        isActive: true,
        config: { sections: t.sections, catalogLabel: t.catalogLabel, heroStyle: t.heroStyle, layout: t.layout },
      },
      create: {
        name,
        category: name,
        config: { sections: t.sections, catalogLabel: t.catalogLabel, heroStyle: t.heroStyle, layout: t.layout },
      },
    });
  }

  // Retire any templates from an older seed run that aren't part of the
  // current 23 — deactivate rather than delete, since a store might still
  // reference one (Store.templateId). Deactivated templates stop showing
  // in the gallery but existing stores using them keep working.
  await prisma.storeTemplate.updateMany({
    where: { name: { notIn: NICHE_NAMES } },
    data: { isActive: false },
  });

  for (const sub of SUBSCRIPTIONS) {
    await prisma.subscription.upsert({
      where: { name: sub.name },
      update: {},
      create: sub,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
