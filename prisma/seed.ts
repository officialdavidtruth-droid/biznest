import { PrismaClient, type Prisma } from "@prisma/client";
import { generateNicheVariations, TEMPLATE_NAME, generateHeenzyVariation, TEMPLATE_NAME_HEENZY, generateNovaVariation, TEMPLATE_NAME_NOVA, generateVioletVariation, TEMPLATE_NAME_VIOLET, generatePremiumVariation, TEMPLATE_NAME_PREMIUM, generateHomeVistaVariation, TEMPLATE_NAME_HOMEVISTA, generateRrwVariation, TEMPLATE_NAME_RRW, generateMarketplaceVariation, TEMPLATE_NAME_MARKETPLACE, generateArcovaVariation, TEMPLATE_NAME_ARCOVA, generateRivoraVariation, TEMPLATE_NAME_RIVORA, generateJuiceLifeVariation, TEMPLATE_NAME_JUICELIFE, generateFabtexVariation, TEMPLATE_NAME_FABTEX } from "../lib/template-themes";
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

  // Subcategories — created after their parents exist, since parentId needs
  // the parent's real id. skipDuplicates on name (globally unique) makes
  // this safe to re-run.
  for (const [parentName, subNames] of Object.entries(PRODUCT_SUBCATEGORIES)) {
    const parent = await prisma.category.findUnique({ where: { name: parentName } });
    if (!parent) continue;
    await prisma.category.createMany({
      data: subNames.map((name) => ({ name, type: "PRODUCT" as const, parentId: parent.id })),
      skipDuplicates: true,
    });
  }
  for (const [parentName, subNames] of Object.entries(SERVICE_SUBCATEGORIES)) {
    const parent = await prisma.category.findUnique({ where: { name: parentName } });
    if (!parent) continue;
    await prisma.category.createMany({
      data: subNames.map((name) => ({ name, type: "SERVICE" as const, parentId: parent.id })),
      skipDuplicates: true,
    });
  }

  // The platform ships eight storefront templates — "Fresh & Co.",
  // "Heenzy Sneaker Co.", "Nova Studio", "Violet", "Premium Marketplace",
  // "HomeVista", "rRW Premium Rental", and "Marketplace Hub" (see lib/template-themes.ts).
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

  const violetTemplate = generateVioletVariation();
  const violetPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_VIOLET);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_VIOLET },
    update: { category: TEMPLATE_NAME_VIOLET, isActive: true, tierRank: violetTemplate.tierRank, previewUrl: violetPreviewUrl, config: violetTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_VIOLET, category: TEMPLATE_NAME_VIOLET, tierRank: violetTemplate.tierRank, previewUrl: violetPreviewUrl, config: violetTemplate as unknown as Prisma.InputJsonValue },
  });

  const premiumTemplate = generatePremiumVariation();
  const premiumPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_PREMIUM);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_PREMIUM },
    update: { category: TEMPLATE_NAME_PREMIUM, isActive: true, tierRank: premiumTemplate.tierRank, previewUrl: premiumPreviewUrl, config: premiumTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_PREMIUM, category: TEMPLATE_NAME_PREMIUM, tierRank: premiumTemplate.tierRank, previewUrl: premiumPreviewUrl, config: premiumTemplate as unknown as Prisma.InputJsonValue },
  });

  const homevistaTemplate = generateHomeVistaVariation();
  const homevistaPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_HOMEVISTA);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_HOMEVISTA },
    update: { category: TEMPLATE_NAME_HOMEVISTA, isActive: true, tierRank: homevistaTemplate.tierRank, previewUrl: homevistaPreviewUrl, config: homevistaTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_HOMEVISTA, category: TEMPLATE_NAME_HOMEVISTA, tierRank: homevistaTemplate.tierRank, previewUrl: homevistaPreviewUrl, config: homevistaTemplate as unknown as Prisma.InputJsonValue },
  });

  const rrwTemplate = generateRrwVariation();
  const rrwPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_RRW);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_RRW },
    update: { category: TEMPLATE_NAME_RRW, isActive: true, tierRank: rrwTemplate.tierRank, previewUrl: rrwPreviewUrl, config: rrwTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_RRW, category: TEMPLATE_NAME_RRW, tierRank: rrwTemplate.tierRank, previewUrl: rrwPreviewUrl, config: rrwTemplate as unknown as Prisma.InputJsonValue },
  });

  const marketplaceTemplate = generateMarketplaceVariation();
  const marketplacePreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_MARKETPLACE);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_MARKETPLACE },
    update: { category: TEMPLATE_NAME_MARKETPLACE, isActive: true, tierRank: marketplaceTemplate.tierRank, previewUrl: marketplacePreviewUrl, config: marketplaceTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_MARKETPLACE, category: TEMPLATE_NAME_MARKETPLACE, tierRank: marketplaceTemplate.tierRank, previewUrl: marketplacePreviewUrl, config: marketplaceTemplate as unknown as Prisma.InputJsonValue },
  });

  const arcovaTemplate = generateArcovaVariation();
  const arcovaPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_ARCOVA);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_ARCOVA },
    update: { category: TEMPLATE_NAME_ARCOVA, isActive: true, tierRank: arcovaTemplate.tierRank, previewUrl: arcovaPreviewUrl, config: arcovaTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_ARCOVA, category: TEMPLATE_NAME_ARCOVA, tierRank: arcovaTemplate.tierRank, previewUrl: arcovaPreviewUrl, config: arcovaTemplate as unknown as Prisma.InputJsonValue },
  });

  const rivoraTemplate = generateRivoraVariation();
  const rivoraPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_RIVORA);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_RIVORA },
    update: { category: TEMPLATE_NAME_RIVORA, isActive: true, tierRank: rivoraTemplate.tierRank, previewUrl: rivoraPreviewUrl, config: rivoraTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_RIVORA, category: TEMPLATE_NAME_RIVORA, tierRank: rivoraTemplate.tierRank, previewUrl: rivoraPreviewUrl, config: rivoraTemplate as unknown as Prisma.InputJsonValue },
  });

  const juicelifeTemplate = generateJuiceLifeVariation();
  const juicelifePreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_JUICELIFE);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_JUICELIFE },
    update: { category: TEMPLATE_NAME_JUICELIFE, isActive: true, tierRank: juicelifeTemplate.tierRank, previewUrl: juicelifePreviewUrl, config: juicelifeTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_JUICELIFE, category: TEMPLATE_NAME_JUICELIFE, tierRank: juicelifeTemplate.tierRank, previewUrl: juicelifePreviewUrl, config: juicelifeTemplate as unknown as Prisma.InputJsonValue },
  });

  const fabtexTemplate = generateFabtexVariation();
  const fabtexPreviewUrl = await fetchDemoPhoto(TEMPLATE_NAME_FABTEX);
  await prisma.storeTemplate.upsert({
    where: { name: TEMPLATE_NAME_FABTEX },
    update: { category: TEMPLATE_NAME_FABTEX, isActive: true, tierRank: fabtexTemplate.tierRank, previewUrl: fabtexPreviewUrl, config: fabtexTemplate as unknown as Prisma.InputJsonValue },
    create: { name: TEMPLATE_NAME_FABTEX, category: TEMPLATE_NAME_FABTEX, tierRank: fabtexTemplate.tierRank, previewUrl: fabtexPreviewUrl, config: fabtexTemplate as unknown as Prisma.InputJsonValue },
  });

  // Retire every other template row (the old niche-generated set, or any
  // prior naming scheme) — deactivate rather than delete, since a store
  // might still reference one (Store.templateId). Deactivated templates
  // stop showing in the gallery but existing stores using them keep working.
  await prisma.storeTemplate.updateMany({
    where: { name: { notIn: [TEMPLATE_NAME, TEMPLATE_NAME_HEENZY, TEMPLATE_NAME_NOVA, TEMPLATE_NAME_VIOLET, TEMPLATE_NAME_PREMIUM, TEMPLATE_NAME_HOMEVISTA, TEMPLATE_NAME_RRW, TEMPLATE_NAME_MARKETPLACE, TEMPLATE_NAME_ARCOVA, TEMPLATE_NAME_RIVORA, TEMPLATE_NAME_JUICELIFE, TEMPLATE_NAME_FABTEX] } },
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
