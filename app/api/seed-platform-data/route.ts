import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// TEMPORARY — populates categories, store templates, and subscription tiers.
// Same reasoning as /api/promote-admin: there's no local terminal with DB
// access to run `npm run db:seed`, so this does it over HTTP once instead.
// Safe to call multiple times (everything is upserted).

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

const TEMPLATES = [
  "Restaurant", "Hotel", "Fashion Store", "Beauty Store", "Electronics",
  "Supermarket", "Furniture", "Photography", "Videography", "Agency",
  "Law Firm", "Hospital", "Pharmacy", "Mechanic", "Salon", "Spa", "Church",
  "School", "Restaurant Delivery", "Construction", "Architecture",
  "Engineering", "Real Estate", "Personal Portfolio", "Freelancer",
  "Marketplace",
];

const SUBSCRIPTIONS = [
  { name: "Free", price: 0, interval: "MONTHLY", commissionRate: 8, features: { products: 20, services: 10 } },
  { name: "Starter", price: 5000, interval: "MONTHLY", commissionRate: 5, features: { products: 200, services: 100 } },
  { name: "Growth", price: 15000, interval: "MONTHLY", commissionRate: 3, features: { products: 2000, services: 1000 } },
  { name: "Pro", price: 40000, interval: "MONTHLY", commissionRate: 1.5, features: { products: -1, services: -1 } },
];

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

  for (const name of TEMPLATES) {
    await prisma.storeTemplate.upsert({
      where: { name },
      update: {},
      create: { name, category: name, config: { sections: ["home", "about", "gallery", "contact"] } },
    });
  }

  for (const sub of SUBSCRIPTIONS) {
    await prisma.subscription.upsert({ where: { name: sub.name }, update: {}, create: sub });
  }

  const counts = {
    categories: await prisma.category.count(),
    templates: await prisma.storeTemplate.count(),
    subscriptions: await prisma.subscription.count(),
  };

  return NextResponse.json({ success: true, message: "Seed complete.", counts });
}
