import { PrismaClient, type Prisma } from "@prisma/client";
import { TEMPLATE_NAME, GRANDEUR_THEME } from "../lib/template-themes";
import { fetchDemoPhoto } from "../lib/demo-images";

const prisma = new PrismaClient();

const PRODUCT_CATEGORIES = [
  "Fashion", "Beauty", "Electronics", "Phones", "Computers", "Food",
  "Groceries", "Furniture", "Home Appliances", "Jewelry", "Books", "Sports",
  "Baby Products", "Automotive", "Health", "Agriculture", "Construction",
  "Pets", "Office Supplies", "Art", "Music", "Gaming", "Toys",
  "Collectibles", "Industrial Equipment",
];

// Subcategories, keyed by parent category name (must match a name in
// PRODUCT_CATEGORIES above). Rendered as a flyout under each category chip
// in the storefront category nav, and as filter chips on category pages.
const PRODUCT_SUBCATEGORIES: Record<string, string[]> = {
  Fashion: ["Men's Clothing", "Women's Clothing", "Men's Shoes", "Women's Shoes", "Kids' Wear", "Bags", "Fashion Accessories", "Traditional Wear"],
  Beauty: ["Skincare", "Makeup Products", "Haircare", "Fragrances", "Bath & Body", "Beauty Tools & Brushes"],
  Electronics: ["TVs", "Audio & Headphones", "Cameras", "Wearables", "Home Theater", "Electronics Accessories"],
  Phones: ["Smartphones", "Tablets", "Phone Accessories", "Chargers & Cables", "Cases & Covers"],
  Computers: ["Laptops", "Desktops", "Monitors", "Keyboards & Mice", "Storage", "Networking"],
  Jewelry: ["Rings", "Necklaces", "Earrings", "Bracelets", "Watches"],
  "Home Appliances": ["Kitchen Appliances", "Refrigerators", "Washing Machines", "Air Conditioners", "Small Appliances"],
  Furniture: ["Living Room", "Bedroom", "Office Furniture", "Outdoor", "Storage Furniture"],
  Sports: ["Fitness Equipment", "Team Sports", "Sports Footwear", "Outdoor & Camping", "Cycling"],
  Groceries: ["Fresh Produce", "Pantry Staples", "Beverages", "Snacks", "Dairy & Eggs"],
  "Baby Products": ["Diapers & Wipes", "Baby Clothing", "Feeding", "Toys & Gear"],
  Automotive: ["Car Parts", "Car Accessories", "Motorcycle", "Automotive Tools & Equipment"],
  Gaming: ["Consoles", "Video Games", "Gaming Accessories", "PC Gaming"],
  Toys: ["Action Figures", "Educational Toys", "Outdoor Play", "Board Games"],
};

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

// Subcategories for services, same pattern as PRODUCT_SUBCATEGORIES above.
const SERVICE_SUBCATEGORIES: Record<string, string[]> = {
  "Graphic Design": ["Flyer Design", "Packaging Design", "Illustration", "Print Design"],
  Photography: ["Wedding Photography", "Portrait Photography", "Product Photography", "Event Photography"],
  Videography: ["Wedding Videography", "Corporate Video", "Music Video", "Drone Footage"],
  "Digital Marketing": ["SEO", "Paid Ads", "Email Marketing", "Content Marketing", "Influencer Marketing"],
  "Social Media Management": ["Instagram Management", "TikTok Management", "Content Creation", "Community Management"],
  "Website Design": ["Landing Pages", "E-commerce Sites", "Portfolio Sites", "Website Maintenance"],
  "Software Development": ["Backend Development", "Frontend Development", "API Integration", "DevOps"],
  "Mobile App Development": ["iOS Development", "Android Development", "Cross-Platform Apps"],
  Writing: ["Copywriting", "Ghostwriting", "Technical Writing", "Resume Writing", "Blog Writing"],
  "Legal Services": ["Contract Drafting", "Business Registration", "Intellectual Property", "Litigation Support"],
  "Electrical Services": ["Wiring Installation", "Solar Installation", "Electrical Repairs", "Inverter Installation"],
  Plumbing: ["Pipe Installation", "Leak Repairs", "Drainage Services", "Bathroom Fitting"],
  Tailoring: ["Bespoke Suits", "Alterations", "Native Wear", "Uniform Tailoring"],
  "Fashion Design": ["Bridal Wear", "Ready-to-Wear", "Costume Design"],
  "Hair Styling": ["Braiding", "Wig Installation", "Barbing", "Natural Hair Care"],
  Makeup: ["Bridal Makeup", "Editorial Makeup", "Special Effects Makeup"],
  Cleaning: ["Home Cleaning", "Office Cleaning", "Post-Construction Cleaning", "Deep Cleaning"],
  Catering: ["Wedding Catering", "Corporate Catering", "Small Chops", "Continental Cuisine"],
  "Event Planning": ["Wedding Planning", "Birthday Planning", "Corporate Events", "Decor & Styling"],
  "Real Estate": ["Property Sales", "Property Rentals", "Property Management", "Land Surveying"],
  "Interior Design": ["Residential Design", "Office Design", "Furniture Sourcing"],
  Tutoring: ["Exam Prep", "Language Tutoring", "STEM Tutoring", "Music Lessons"],
  Fitness: ["Personal Training", "Yoga Instruction", "Nutrition Coaching", "Group Classes"],
  "Automobile Repairs": ["Engine Repair", "Auto Electrical", "Panel Beating", "Car AC Repair"],
  Mechanics: ["General Servicing", "Diagnostics", "Tire & Wheel Services"],
};


// Pricing tiers. "Free" stays as the entry tier for new vendors — the three
// named paid tiers below are what's actually being sold. commissionRate and
// product/service caps step down as price goes up; customDomain unlocks at
// Enterprise and above. -1 in features means unlimited.
// templateTier: 1=Free, 2=Entrepreneur, 3=Enterprise, 4=Business Mogul.
// A store can pick any StoreTemplate whose tierRank <= its plan's templateTier
// — matches TIER_RANK in lib/template-themes.ts, keep both in sync.
// Only two plans, both paid monthly — no free tier. Users choose one during
// mandatory checkout right after onboarding (see app/onboarding/select-plan)
// and can't reach their dashboard until Store.subscriptionId is set (see
// app/store/[slug]/admin/layout.tsx). Old tiers below are deactivated by the
// updateMany at the bottom of main(), not deleted, since existing stores may
// still reference them via Store.subscriptionId.
const SUBSCRIPTIONS = [
  {
    name: "Store Templates",
    price: 15000,
    interval: "MONTHLY",
    commissionRate: 5,
    features: { products: 300, services: 150, customDomain: false, templateTier: 2 },
  },
  {
    name: "Growth Store",
    price: 45000,
    interval: "MONTHLY",
    commissionRate: 3,
    features: { products: 3000, services: 1500, customDomain: true, templateTier: 3 },
  },
  {
    name: "Business Mogul",
    price: 139000,
    interval: "MONTHLY",
    commissionRate: 1,
    features: { products: -1, services: -1, customDomain: true, templateTier: 4 },
  },
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

  // Subcategories — created after their parents exist, since parentId needs
  // the parent's real id. skipDuplicates on name (globally unique) makes
  // this safe to re-run.
  for (const [parentName, subNames] of Object.entries(PRODUCT_SUBCATEGORIES)) {
    const parent = await prisma.category.findFirst({ where: { name: parentName } });
    if (!parent) continue;
    await prisma.category.createMany({
      data: subNames.map((name) => ({ name, type: "PRODUCT" as const, parentId: parent.id })),
      skipDuplicates: true,
    });
  }
  for (const [parentName, subNames] of Object.entries(SERVICE_SUBCATEGORIES)) {
    const parent = await prisma.category.findFirst({ where: { name: parentName } });
    if (!parent) continue;
    await prisma.category.createMany({
      data: subNames.map((name) => ({ name, type: "SERVICE" as const, parentId: parent.id })),
      skipDuplicates: true,
    });
  }

  // Template reset: the legacy collection is retired. Only the new
  // Grandeur Restaurant template is seeded from this point forward.
  const grandeur = await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME },
    update: {
      category: "Restaurant",
      isActive: true,
      tierRank: 3,
      previewUrl: await fetchDemoPhoto(TEMPLATE_NAME),
      config: GRANDEUR_THEME as unknown as Prisma.InputJsonValue,
    },
    create: {
      name: TEMPLATE_NAME,
      category: "Restaurant",
      isActive: true,
      tierRank: 3,
      previewUrl: await fetchDemoPhoto(TEMPLATE_NAME),
      config: GRANDEUR_THEME as unknown as Prisma.InputJsonValue,
    },
  });

  // Hard reset the template registry. Store.templateId is nullable, so old
  // assignments are cleared before the retired rows are removed. No legacy
  // template can leak back into the gallery or renderer after this seed.
  await prisma.store.updateMany({
    where: { templateId: { not: grandeur.id } },
    data: { templateId: null },
  });
  await prisma.storeTemplate.deleteMany({
    where: { id: { not: grandeur.id } },
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
