import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SIGNATURE_TEMPLATE_CATALOG,
  getSignatureTheme,
  isArcovaTemplate,
  isFabtexTemplate,
  isHeenzyTemplate,
  isHomeVistaTemplate,
  isJuiceLifeTemplate,
  isMarketplaceTemplate,
  isNovaTemplate,
  isPremiumTemplate,
  isRivoraTemplate,
  isRrwTemplate,
  isVioletTemplate,
  resolveStoreTheme,
  TEMPLATE_NAME,
  TEMPLATE_NAME_ARCOVA,
  TEMPLATE_NAME_FABTEX,
  TEMPLATE_NAME_HEENZY,
  TEMPLATE_NAME_HEENZY_BOUTIQUE,
  TEMPLATE_NAME_HOMEVISTA,
  TEMPLATE_NAME_JUICELIFE,
  TEMPLATE_NAME_MARKETPLACE,
  TEMPLATE_NAME_NOVA,
  TEMPLATE_NAME_NOVA_IVORY,
  TEMPLATE_NAME_PREMIUM,
  TEMPLATE_NAME_RIVORA,
  TEMPLATE_NAME_RRW,
  TEMPLATE_NAME_VIOLET,
  TEMPLATE_NAME_VIOLET_SUNSET,
  isSignatureTemplate,
  isProfessionalServicesTemplate,
  getProfessionalServicesTheme,
  PROFESSIONAL_SERVICE_TEMPLATE_CATALOG,
  type TemplateTheme,
} from "@/lib/template-themes";
import { HeenzyStorefront } from "@/components/storefront/templates/heenzy-home";
import { NovaStorefront } from "@/components/storefront/templates/nova-home";
import { VioletStorefront } from "@/components/storefront/templates/violet-home";
import { PremiumStorefront } from "@/components/storefront/templates/premium-home";
import { HomeVistaStorefront } from "@/components/storefront/templates/homevista-home";
import { RrwStorefront } from "@/components/storefront/templates/rrw-home";
import { MarketplaceStorefront } from "@/components/storefront/templates/marketplace-home";
import { ArcovaStorefront } from "@/components/storefront/templates/arcova-home";
import { RivoraStorefront } from "@/components/storefront/templates/rivora-home";
import { JuiceLifeStorefront } from "@/components/storefront/templates/juicelife-home";
import { FabtexStorefront } from "@/components/storefront/templates/fabtex-home";
import { SignatureStorefront } from "@/components/storefront/templates/signature-home";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";
import { HotelStorefront } from "@/components/storefront/templates/hotel-home";
import { ProfessionalServicesStorefront } from "@/components/storefront/templates/professional-services-home";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BizNest Template Preview",
  robots: { index: false, follow: false },
};

type PreviewCatalogItem = {
  id: string;
  kind: "product" | "service";
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image: string | null;
  categoryName: string | null;
  type: string;
  rentalUnit: string | null;
  isBookable: boolean;
};

type PreviewReview = {
  id: string;
  rating: number;
  comment: string | null;
  author: { name: string | null };
};

type PreviewStore = {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null; verificationBadge?: boolean };
  reviews: PreviewReview[];
  template?: { previewUrl: string | null } | null;
};

const PREVIEW_SLUG = "__biznest-template-preview";

const PREVIEW_PROFILES: Record<string, { name: string; description: string; tags: string[]; itemNames: string[] }> = {
  [TEMPLATE_NAME]: {
    name: "Fresh & Co. Market",
    description: "Fresh, reliable products and thoughtful service, presented in a clean storefront built for easy discovery and checkout.",
    tags: ["Fresh Picks", "Everyday Essentials", "New Arrivals", "Best Sellers"],
    itemNames: ["Fresh Produce Box", "Weekly Essentials", "Premium Pantry Pack", "Market Breakfast Bundle", "Organic Honey", "Cold-Pressed Juice"],
  },
  [TEMPLATE_NAME_HEENZY]: {
    name: "Heenzy Sneaker Co.",
    description: "Curated sneakers and streetwear for people who take their everyday style seriously.",
    tags: ["Men's Shoes", "Women's Shoes", "Streetwear", "Accessories"],
    itemNames: ["Air Runner '99", "Court Classic", "Trail Max", "Heenzy Hoodie", "Canvas Low", "Limited Drop"],
  },
  [TEMPLATE_NAME_HEENZY_BOUTIQUE]: {
    name: "Heenzy — Boutique Rose",
    description: "A considered edit of wearable pieces, selected for quality, comfort and effortless style.",
    tags: ["The Edit", "New Season", "Accessories", "Limited Pieces"],
    itemNames: ["Silk Overshirt", "Everyday Tailored Trouser", "Soft Knit Set", "Leather Mini Bag", "Rose Sneaker", "Signature Jacket"],
  },
  [TEMPLATE_NAME_NOVA]: {
    name: "Nova Studio",
    description: "Brand identity, photography and creative direction for businesses that want to feel considered.",
    tags: ["Branding", "Photography", "Web Design", "Creative Direction"],
    itemNames: ["Brand Identity Package", "Product Photography", "Website Design", "Social Content Retainer", "Packaging Design", "Brand Strategy"],
  },
  [TEMPLATE_NAME_NOVA_IVORY]: {
    name: "Nova Studio — Ivory",
    description: "A refined creative studio delivering identity, digital design and visual storytelling with precision.",
    tags: ["Identity", "Digital", "Editorial", "Strategy"],
    itemNames: ["Identity Direction", "Editorial Shoot", "Website System", "Campaign Art Direction", "Packaging Suite", "Strategy Session"],
  },
  [TEMPLATE_NAME_VIOLET]: {
    name: "Violet",
    description: "A modern commerce destination for curated collections, seasonal drops and everyday essentials.",
    tags: ["New Arrivals", "Trending", "Collections", "Best Sellers"],
    itemNames: ["Essential Tote", "Studio Shirt", "Everyday Trainer", "Signature Set", "Weekend Bag", "New Season Jacket"],
  },
  [TEMPLATE_NAME_VIOLET_SUNSET]: {
    name: "Violet — Sunset",
    description: "A warmer, expressive take on modern commerce with curated products and seasonal collections.",
    tags: ["New Season", "Sunset Edit", "Trending", "Limited"],
    itemNames: ["Sunset Runner", "Terracotta Shirt", "Canvas Carryall", "Soft Knit", "Weekend Sneaker", "Limited Edition"],
  },
  [TEMPLATE_NAME_PREMIUM]: {
    name: "Premium Marketplace",
    description: "A dense, high-conversion marketplace experience built around discovery, deals and confident checkout.",
    tags: ["Electronics", "Fashion", "Home", "Deals"],
    itemNames: ["Wireless Headphones", "Smart Watch", "Premium Sneakers", "Everyday Backpack", "Home Speaker", "Portable Charger"],
  },
  [TEMPLATE_NAME_HOMEVISTA]: {
    name: "HomeVista",
    description: "Discover beautiful homes and properties with clear listings, useful details and a confident browsing experience.",
    tags: ["Apartments", "Houses", "Luxury", "Rentals"],
    itemNames: ["Modern 3-Bed Apartment", "Garden Residence", "City View Penthouse", "Family Duplex", "Coastal Villa", "Executive Suite"],
  },
  [TEMPLATE_NAME_RRW]: {
    name: "rRW Premium Rental",
    description: "Premium vehicles, flexible rental options and a polished booking experience for every journey.",
    tags: ["Luxury", "SUV", "Executive", "Weekend"],
    itemNames: ["Range Rover Sport", "Mercedes GLE", "BMW 5 Series", "Porsche Cayenne", "Toyota Land Cruiser", "Executive Van"],
  },
  [TEMPLATE_NAME_MARKETPLACE]: {
    name: "Marketplace Hub",
    description: "A familiar big-box shopping experience with categories, promotions, product rails and trusted service.",
    tags: ["Phones", "Computing", "Fashion", "Home"],
    itemNames: ["Smartphone Pro", "Laptop Air", "Wireless Earbuds", "Running Shoes", "Office Chair", "4K Smart TV"],
  },
  [TEMPLATE_NAME_ARCOVA]: {
    name: "Arcova Architecture",
    description: "Architecture, design and delivery shaped around thoughtful spaces, strong ideas and precise execution.",
    tags: ["Architecture", "Interiors", "Design", "Build"],
    itemNames: ["Residential Concept", "Modern Villa", "Office Interior", "Hospitality Project", "Retail Space", "Design Consultation"],
  },
  [TEMPLATE_NAME_RIVORA]: {
    name: "Rivora Fresh",
    description: "Fresh food and everyday essentials presented with a bright, premium shopping experience.",
    tags: ["Fresh", "Pantry", "Drinks", "Organic"],
    itemNames: ["Farm Fresh Basket", "Breakfast Box", "Organic Pantry", "Fruit Selection", "Fresh Bread", "Daily Essentials"],
  },
  [TEMPLATE_NAME_JUICELIFE]: {
    name: "JuiceLife",
    description: "Cold-pressed drinks, fresh ingredients and feel-good favourites made for everyday wellness.",
    tags: ["Juices", "Wellness", "Bundles", "Fresh Menu"],
    itemNames: ["Green Glow", "Berry Boost", "Citrus Cleanse", "Tropical Press", "Wellness Pack", "Morning Bundle"],
  },
  [TEMPLATE_NAME_FABTEX]: {
    name: "Fabtex",
    description: "A polished fashion storefront for curated pieces, seasonal collections and easy shopping.",
    tags: ["New Season", "Women", "Men", "Accessories"],
    itemNames: ["Tailored Blazer", "Everyday Shirt", "Signature Dress", "Leather Loafers", "Weekend Set", "Classic Tote"],
  },
};

const SIGNATURE_PROFILE: Record<string, { name: string; description: string; tags: string[]; itemNames: string[] }> = {
  electra: { name: "Electra", description: "Premium electronics presented through a clean, comparison-friendly storefront built for confident shopping.", tags: ["Phones", "Audio", "Computing", "Smart Home"], itemNames: ["Studio Headphones", "Smart Display", "Laptop Pro", "Phone Ultra", "Wireless Speaker", "Creator Monitor"] },
  atelier: { name: "Atelier", description: "An editorial fashion storefront with curated collections, generous imagery and a strong visual rhythm.", tags: ["New Season", "Outerwear", "Accessories", "Shoes"], itemNames: ["Silk Shirt", "Tailored Coat", "Leather Bag", "Studio Sneaker", "Knit Set", "Evening Dress"] },
  kinetic: { name: "Kinetic", description: "A high-energy sneaker storefront designed for drops, scarcity and fast product discovery.", tags: ["Latest Drop", "Sneakers", "Streetwear", "Limited"], itemNames: ["Velocity 01", "Night Runner", "Volt Trainer", "Kinetic Hoodie", "Drop Cap", "Limited Box"] },
  bloom: { name: "Bloom", description: "A soft, premium beauty storefront for skincare, makeup, haircare and self-care collections.", tags: ["Skincare", "Makeup", "Haircare", "Self Care"], itemNames: ["Daily Serum", "Glow Cream", "Soft Matte Set", "Hair Ritual Kit", "Body Oil", "Night Recovery"] },
  haven: { name: "Haven", description: "Refined furniture and interiors presented through room-led collections and tactile product storytelling.", tags: ["Living", "Bedroom", "Dining", "Decor"], itemNames: ["Lounge Chair", "Oak Console", "Linen Sofa", "Ceramic Table Lamp", "Dining Set", "Woven Rug"] },
  harvest: { name: "Harvest", description: "A fast grocery storefront built around categories, weekly picks, deals and repeat shopping.", tags: ["Fresh Picks", "Pantry", "Drinks", "Deals"], itemNames: ["Fresh Fruit Box", "Weekly Pantry", "Farm Eggs", "Breakfast Bundle", "Juice Pack", "Dinner Essentials"] },
  maison: { name: "Maison", description: "A hospitality storefront designed around rooms, amenities, availability and direct booking confidence.", tags: ["Rooms", "Suites", "Amenities", "Experiences"], itemNames: ["Deluxe Room", "Garden Suite", "Executive Suite", "Family Room", "Penthouse Stay", "Weekend Package"] },
  hotel: { name: "Grand", description: "A company-first hospitality website built around story, rooms, experience, visual narrative and direct guest enquiries.", tags: ["Rooms", "Suites", "Experience", "Gallery"], itemNames: ["Deluxe Room", "Executive Suite", "Premier Suite", "Diplomatic Suite", "Presidential Suite", "Residence"] },
  ember: { name: "Ember", description: "A restaurant storefront built around signature dishes, menu discovery and reservations or ordering.", tags: ["Starters", "Mains", "Drinks", "Desserts"], itemNames: ["Charred Chicken", "Ember Steak", "Truffle Pasta", "Citrus Salad", "House Cocktail", "Chocolate Tart"] },
  muse: { name: "Muse", description: "A salon experience built around services, specialists, packages and effortless booking.", tags: ["Hair", "Nails", "Beauty", "Packages"], itemNames: ["Signature Cut", "Silk Press", "Gel Manicure", "Facial Ritual", "Bridal Package", "Full Glow Session"] },
  frame: { name: "Frame", description: "A cinematic photography storefront with portfolio-first storytelling and clear packages.", tags: ["Weddings", "Portraits", "Commercial", "Editorial"], itemNames: ["Wedding Collection", "Portrait Session", "Product Shoot", "Editorial Day", "Brand Film", "Studio Package"] },
  north: { name: "North", description: "A sharp agency storefront focused on capabilities, proof, process and confident project starts.", tags: ["Strategy", "Branding", "Digital", "Campaigns"], itemNames: ["Brand Strategy", "Identity System", "Website Sprint", "Campaign Direction", "Content Retainer", "Growth Workshop"] },
  pure: { name: "Pure", description: "A trustworthy cleaning storefront built around services, packages, coverage areas and booking.", tags: ["Home", "Office", "Deep Clean", "Packages"], itemNames: ["Home Clean", "Office Clean", "Deep Clean", "Move-Out Clean", "Monthly Package", "Post-Construction"] },
  forge: { name: "Forge", description: "A construction storefront designed around projects, services, proof, process and quote requests.", tags: ["Build", "Renovation", "Interiors", "Consulting"], itemNames: ["Home Renovation", "Office Build", "Kitchen Remodel", "Interior Fit-Out", "Project Survey", "Build Consultation"] },
  "great-treasure": { name: "Great Treasure", description: "Luxury hotel and suites with rooms, food, amenities and direct booking.", tags: ["Rooms", "Suites", "Food", "Amenities"], itemNames: ["Standard Room", "Deluxe Room", "Executive Suite", "Presidential Suite", "Restaurant Menu", "Event Hall"] },
  "grand-vere": { name: "Grand Vere", description: "Timeless hotel and resort hospitality with elegant rooms, dining, gallery and guest experiences.", tags: ["Rooms", "Suites", "Amenities", "Dining"], itemNames: ["Deluxe Room", "Ocean View Suite", "Executive Suite", "Private Villa", "Spa Experience", "Dinner Reservation"] },
  belora: { name: "Belora", description: "Clean beauty, conscious choices and premium skincare for every skin type.", tags: ["Skin Care", "Makeup", "Hair Care", "Gift Sets"], itemNames: ["Glow Face Serum", "Hydrating Moisturizer", "Radiance Face Wash", "Matte Lipstick", "Rose Water Toner", "Self Care Set"] },
  tastehouse: { name: "TasteHouse", description: "Food delivery built around cuisines, popular dishes, offers and fast checkout.", tags: ["Italian", "Chinese", "Indian", "Mexican"], itemNames: ["Grilled Chicken", "Margherita Pizza", "Paneer Butter Masala", "Sushi Platter", "Chocolate Lava Cake", "Family Combo"] },
  "flavora-kitchen": { name: "Flavora Kitchen", description: "Bold, fresh food with an easy online ordering experience.", tags: ["Starters", "Main Course", "Desserts", "Drinks"], itemNames: ["Chicken Tikka", "Signature Burger", "Spaghetti Carbonara", "Lamb Rogan Josh", "Margherita Pizza", "Seafood Paella"] },
  "flavora-restaurant": { name: "Flavora", description: "A warm restaurant experience centered on delicious food, ambience and reservations.", tags: ["Starters", "Mains", "Desserts", "Drinks"], itemNames: ["Creamy Alfredo Pasta", "Grilled Chicken Steak", "Margherita Pizza", "Chocolate Lava Cake", "Seafood Paella", "Chef's Special"] },
};

const PROFESSIONAL_PROFILES: Record<string, { name:string; description:string; tags:string[]; itemNames:string[] }> = {
  "Obsidian Atelier — Graphic Design & Print": { name:"Obsidian Atelier", description:"Premium graphic design, branding and print production for brands that care about every detail.", tags:["Branding","Print","Packaging","Campaigns"], itemNames:["Brand Identity","Campaign Art Direction","Premium Business Cards","Luxury Packaging","Campaign Poster","Large Format Print"] },
  "Noir Identity — Brand Strategy": { name:"Noir Identity", description:"Strategic brand identity and art direction for distinctive businesses.", tags:["Strategy","Identity","Art Direction","Guidelines"], itemNames:["Brand Strategy","Visual Identity","Art Direction","Brand Guidelines","Naming Workshop","Launch System"] },
  "Cobalt Bureau — Marketing & Digital": { name:"Cobalt Bureau", description:"Campaigns, digital experiences and growth systems built for measurable momentum.", tags:["Campaigns","Growth","Content","Performance"], itemNames:["Campaign Strategy","Performance Marketing","Content System","Growth Workshop","Launch Campaign","Digital Retainer"] },
  "Nocturne Studio — Photography": { name:"Nocturne Studio", description:"Cinematic photography for portraits, products, editorial and commercial brands.", tags:["Portraits","Commercial","Editorial","Products"], itemNames:["Portrait Session","Brand Campaign","Product Studio","Editorial Day","Executive Portraits","Campaign Library"] },
  "Meridian Advisory — Consulting": { name:"Meridian Advisory", description:"Independent strategy and executive advisory for consequential decisions.", tags:["Strategy","Transformation","Research","Workshops"], itemNames:["Strategy Advisory","Market Intelligence","Transformation Sprint","Executive Workshop","Growth Review","Board Advisory"] },
  "Ledger House — Accounting & Finance": { name:"Ledger House", description:"Modern accounting, tax and financial advisory for growing businesses.", tags:["Accounting","Tax","Reporting","Advisory"], itemNames:["Monthly Accounting","Tax Advisory","Financial Reporting","CFO Advisory","Bookkeeping Review","Business Forecast"] },
  "Crown & Chambers — Legal": { name:"Crown & Chambers", description:"Discreet commercial counsel, contracts and representation.", tags:["Corporate","Contracts","IP","Disputes"], itemNames:["Corporate Counsel","Contract Review","IP Advisory","Dispute Consultation","Company Formation","Legal Retainer"] },
  "Bluebird People — HR & Recruitment": { name:"Bluebird People", description:"Executive search, recruitment and people strategy for ambitious teams.", tags:["Executive Search","Recruitment","People","Culture"], itemNames:["Executive Search","Talent Acquisition","People Strategy","Employer Brand","Leadership Search","Hiring Sprint"] },
  "Signal Labs — Web & Software": { name:"Signal Labs", description:"High-performance websites and software designed around business outcomes.", tags:["Web","Product","Engineering","Growth"], itemNames:["Website Platform","Product Design Sprint","Software Build","API Integration","Growth System","Maintenance Retainer"] },
  "Northstar Systems — IT & Technology": { name:"Northstar Systems", description:"Managed IT, cybersecurity and cloud infrastructure for modern teams.", tags:["Managed IT","Security","Cloud","Support"], itemNames:["Managed IT","Cybersecurity Audit","Cloud Migration","Support Retainer","Network Review","Backup & Recovery"] },
  "Forma House — Architecture & Interiors": { name:"Forma House", description:"Architecture and interiors shaped by proportion, material and light.", tags:["Architecture","Interiors","Residential","Commercial"], itemNames:["Residential Concept","Interior Scheme","Hospitality Project","Office Interior","Spatial Strategy","Project Delivery"] },
  "Axis Engineering — Engineering": { name:"Axis Engineering", description:"Engineering confidence from concept through delivery.", tags:["Structural","Civil","MEP","Technical"], itemNames:["Structural Review","Civil Design","MEP Systems","Technical Survey","Engineering Report","Project Supervision"] },
  "Foundry Build — Construction": { name:"Foundry Build", description:"Construction, renovation and project delivery with a clear process.", tags:["New Build","Renovation","Fit-out","Project Management"], itemNames:["New Build","Home Renovation","Commercial Fit-out","Project Management","Site Survey","Construction Estimate"] },
};

const SIGNATURE_NAMES = new Set(SIGNATURE_TEMPLATE_CATALOG.map((t) => t.variationName));

export function generateStaticParams() {
  const legacyNames = [
    TEMPLATE_NAME,
    TEMPLATE_NAME_HEENZY,
    TEMPLATE_NAME_HEENZY_BOUTIQUE,
    TEMPLATE_NAME_NOVA,
    TEMPLATE_NAME_NOVA_IVORY,
    TEMPLATE_NAME_VIOLET,
    TEMPLATE_NAME_VIOLET_SUNSET,
    TEMPLATE_NAME_PREMIUM,
    TEMPLATE_NAME_HOMEVISTA,
    TEMPLATE_NAME_RRW,
    TEMPLATE_NAME_MARKETPLACE,
    TEMPLATE_NAME_ARCOVA,
    TEMPLATE_NAME_RIVORA,
    TEMPLATE_NAME_JUICELIFE,
    TEMPLATE_NAME_FABTEX,
  ];
  return [...legacyNames, ...SIGNATURE_NAMES, ...PROFESSIONAL_SERVICE_TEMPLATE_CATALOG.map((t) => t.variationName)].map((name) => ({ name }));
}

function svgDataUri(label: string, bg: string, accent: string): string {
  const safe = label.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="0.55" stop-color="${accent}"/><stop offset="1" stop-color="#111827"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="48"/></filter></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1220" cy="190" r="230" fill="#fff" opacity=".13" filter="url(#b)"/><circle cx="420" cy="700" r="300" fill="#000" opacity=".18" filter="url(#b)"/><path d="M0 710C280 570 410 760 720 620s480-160 880 20v260H0Z" fill="#000" opacity=".2"/><text x="90" y="730" fill="#fff" opacity=".92" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700">${safe}</text><text x="94" y="785" fill="#fff" opacity=".65" font-family="Arial,Helvetica,sans-serif" font-size="24" letter-spacing="6">BIZNEST TEMPLATE PREVIEW</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function profileFor(templateName: string, theme: TemplateTheme) {
  if (PROFESSIONAL_PROFILES[templateName]) return PROFESSIONAL_PROFILES[templateName];
  if (SIGNATURE_NAMES.has(templateName)) {
    const signature = getSignatureTheme(templateName);
    return SIGNATURE_PROFILE[signature.signatureMode] ?? SIGNATURE_PROFILE.electra;
  }
  return PREVIEW_PROFILES[templateName] ?? {
    name: templateName,
    description: theme.sub,
    tags: [theme.catalogLabel, "Featured", "New", "Popular"],
    itemNames: ["Featured Collection", "Signature Item", "Everyday Essential", "New Arrival", "Best Seller", "Limited Edition"],
  };
}

function makePreviewData(templateName: string, theme: TemplateTheme) {
  const profile = profileFor(templateName, theme);
  const dark = theme.bg.toLowerCase() === "#0a0a0c" || theme.bg.toLowerCase() === "#0b0b0d" || theme.bg.toLowerCase() === "#171313";
  const logo = svgDataUri(profile.name, dark ? "#111827" : theme.ink, theme.accent);
  const banner = svgDataUri(profile.name, dark ? theme.surfaceDark || theme.ink : theme.bg, theme.accent);
  const items: PreviewCatalogItem[] = profile.itemNames.map((name, index) => ({
    id: `preview-${index + 1}`,
    kind: /hotel|room|clean|consult|session|service|package|rent|build|strategy|photography|design|branding/i.test(`${profile.name} ${name}`) ? "service" : "product",
    name,
    description: `${name} — a polished example item showing how real catalog content appears inside this template.`,
    price: [45000, 78000, 125000, 185000, 245000, 320000][index] ?? 95000,
    currency: "₦",
    image: svgDataUri(name, theme.card, theme.accent),
    categoryName: profile.tags[index % profile.tags.length],
    type: "STANDARD",
    rentalUnit: null,
    isBookable: /service|package|session|room|clean|consult|build|photography|design|strategy/i.test(name),
  }));
  const reviews: PreviewReview[] = [
    { id: "review-1", rating: 5, comment: "Beautiful presentation, easy to browse and exactly what I needed.", author: { name: "Amina O." } },
    { id: "review-2", rating: 5, comment: "The experience feels polished from the first section to checkout.", author: { name: "Daniel K." } },
    { id: "review-3", rating: 4, comment: "Clean, fast and easy to understand.", author: { name: "Chisom E." } },
  ];
  const store: PreviewStore = {
    name: profile.name,
    slug: PREVIEW_SLUG,
    logoUrl: logo,
    bannerUrl: banner,
    contactEmail: "hello@preview.biznest.space",
    contactPhone: "+234 800 000 0000",
    business: { description: profile.description, verificationBadge: true },
    reviews,
    template: { previewUrl: banner },
  };
  return { store, items, reviews };
}

export default async function TemplatePreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  const templateName = decodeURIComponent(rawName);

  let theme: TemplateTheme;
  if (isProfessionalServicesTemplate(templateName)) {
    theme = getProfessionalServicesTheme(templateName);
  } else if (isSignatureTemplate(templateName)) {
    theme = getSignatureTheme(templateName);
  } else {
    theme = resolveStoreTheme(undefined, "Preview", null, null, templateName);
  }

  const isKnown =
    templateName === TEMPLATE_NAME ||
    isHeenzyTemplate(templateName) ||
    isNovaTemplate(templateName) ||
    isVioletTemplate(templateName) ||
    isPremiumTemplate(templateName) ||
    isHomeVistaTemplate(templateName) ||
    isRrwTemplate(templateName) ||
    isMarketplaceTemplate(templateName) ||
    isArcovaTemplate(templateName) ||
    isRivoraTemplate(templateName) ||
    isJuiceLifeTemplate(templateName) ||
    isFabtexTemplate(templateName) ||
    isSignatureTemplate(templateName) ||
    isProfessionalServicesTemplate(templateName);

  if (!isKnown) notFound();

  const { store, items, reviews } = makePreviewData(templateName, theme);
  const avgRating = 4.8;
  const social: Record<string, string> = {};
  const navCategories: never[] = [];
  const goodReviews = reviews.filter((review) => review.rating >= 4 && review.comment);

  // Keep this slug isolated from customer stores. The preview components still
  // render their production markup and interactions, but any internal link is
  // deliberately contained inside the preview URL space instead of pointing
  // at a real merchant.
  const slug = PREVIEW_SLUG;

  if (isProfessionalServicesTemplate(templateName)) {
    const professionalTheme = getProfessionalServicesTheme(templateName);
    return <ProfessionalServicesStorefront store={store} slug={slug} catalogItems={items} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} social={social} theme={professionalTheme} />;
  }

  if (isSignatureTemplate(templateName)) {
    const signatureTheme = getSignatureTheme(templateName);
    if (signatureTheme.signatureMode === "hotel") {
      return <HotelStorefront store={store} slug={slug} catalogItems={items} goodReviews={goodReviews} avgRating={avgRating} social={social} theme={signatureTheme} />;
    }
    if (["great-treasure", "grand-vere", "belora", "tastehouse", "flavora-kitchen", "flavora-restaurant"].includes(signatureTheme.signatureMode)) {
      return <SignatureScreenshotHome store={store} slug={slug} items={items} reviews={reviews} avgRating={avgRating} completedOrders={128} social={social} mode={signatureTheme.signatureMode} accent={signatureTheme.accent} bg={signatureTheme.bg} ink={signatureTheme.ink} card={signatureTheme.card} muted={signatureTheme.muted || `${signatureTheme.ink}99`} border={signatureTheme.border || `${signatureTheme.ink}18`} accentSoft={signatureTheme.accentSoft || signatureTheme.accent} headlineFont={signatureTheme.headlineFont} font={signatureTheme.font} />;
    }
    return (
      <SignatureStorefront
        store={store}
        slug={slug}
        catalogItems={items}
        navCategories={navCategories}
        goodReviews={goodReviews}
        avgRating={avgRating}
        completedOrders={128}
        social={social}
        theme={signatureTheme}
      />
    );
  }

  if (isHeenzyTemplate(templateName)) {
    return <HeenzyStorefront store={store} slug={slug} catalogItems={items} catalogCategories={[]} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} theme={theme} />;
  }
  if (isNovaTemplate(templateName)) {
    return <NovaStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} theme={theme} heroOverrides={null} />;
  }
  if (isVioletTemplate(templateName)) {
    return <VioletStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} theme={theme} heroOverrides={null} />;
  }
  if (isPremiumTemplate(templateName)) {
    return <PremiumStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isHomeVistaTemplate(templateName)) {
    return <HomeVistaStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isRrwTemplate(templateName)) {
    return <RrwStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isMarketplaceTemplate(templateName)) {
    return <MarketplaceStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isArcovaTemplate(templateName)) {
    return <ArcovaStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isRivoraTemplate(templateName)) {
    return <RivoraStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isJuiceLifeTemplate(templateName)) {
    return <JuiceLifeStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }
  if (isFabtexTemplate(templateName)) {
    return <FabtexStorefront store={store} slug={slug} catalogItems={items} navCategories={navCategories} goodReviews={goodReviews} avgRating={avgRating} completedOrders={128} trustScore={null} trustChecklist={null} social={social} />;
  }

  // Fresh & Co. uses the original production renderer from the store page.
  return <FreshPreviewRenderer store={store} slug={slug} catalogItems={items} goodReviews={goodReviews} avgRating={avgRating} theme={theme} />;
}

function FreshPreviewRenderer({
  store,
  slug,
  catalogItems,
  goodReviews,
  avgRating,
  theme,
}: {
  store: PreviewStore;
  slug: string;
  catalogItems: PreviewCatalogItem[];
  goodReviews: PreviewReview[];
  avgRating: number;
  theme: TemplateTheme;
}) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }

  const wrap: React.CSSProperties = { width: "90%", maxWidth: 1180, margin: "0 auto" };
  const primary = theme.accent;
  const ink = theme.ink;
  return (
    <div className="storefront-root" style={{ minHeight: "100vh", background: theme.bg, color: ink, fontFamily: theme.font }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 20, background: `${theme.bg}ee`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${theme.border || `${ink}18`}` }}>
        <div style={{ ...wrap, minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href={`/${slug}`} style={{ color: ink, textDecoration: "none", fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", gap: 9 }}>
            <img src={store.logoUrl!} alt="" width={34} height={34} style={{ borderRadius: 9, objectFit: "cover" }} />
            {store.name}
          </a>
          <div style={{ display: "flex", gap: 18, fontSize: 12, fontWeight: 700 }}>
            <a href="#catalog" style={{ color: ink, textDecoration: "none" }}>Services</a>
            <a href="#about" style={{ color: ink, textDecoration: "none" }}>About</a>
            <CartLink storeSlug={slug} accent={primary} ink={ink} />
            <AccountLink storeSlug={slug} ink={ink} />
          </div>
        </div>
      </nav>
      <header style={{ ...wrap, padding: "30px 0 0" }}>
        <div style={{ minHeight: 470, borderRadius: 24, overflow: "hidden", position: "relative", background: `linear-gradient(100deg, rgba(10,30,18,.84), rgba(10,30,18,.18)), url(${store.bannerUrl}) center/cover`, color: "#fff", display: "flex", alignItems: "center" }}>
          <div style={{ padding: "58px 56px", maxWidth: 650 }}>
            <div style={{ color: theme.accent, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>{theme.eyebrow}</div>
            <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(38px,5vw,62px)", lineHeight: 1.02, margin: "16px 0" }}>{store.name}</h1>
            <p style={{ maxWidth: 500, color: "rgba(255,255,255,.82)", lineHeight: 1.7 }}>{store.business.description}</p>
            <a href="#catalog" style={{ display: "inline-block", marginTop: 24, background: primary, color: "#fff", textDecoration: "none", padding: "13px 19px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>{theme.cta} →</a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 36, padding: "28px 0", flexWrap: "wrap" }}>
          <div><b style={{ display: "block", fontSize: 24 }}>{catalogItems.length}+</b><span style={{ fontSize: 12, opacity: .65 }}>Services & products</span></div>
          <div><b style={{ display: "block", fontSize: 24 }}>128+</b><span style={{ fontSize: 12, opacity: .65 }}>Completed orders</span></div>
          <div><b style={{ display: "block", fontSize: 24 }}>{avgRating.toFixed(1)}/5</b><span style={{ fontSize: 12, opacity: .65 }}>Average rating</span></div>
        </div>
      </header>
      <section id="about" style={{ padding: "70px 0" }}>
        <div className="bn-2col" style={{ ...wrap, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 50, alignItems: "center" }}>
          <div>
            <div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Why choose us</div>
            <h2 style={{ fontFamily: theme.headlineFont, fontSize: 38, margin: "12px 0" }}>A storefront that makes the business feel real.</h2>
            <p style={{ lineHeight: 1.8, opacity: .72 }}>{store.business.description}</p>
          </div>
          <div style={{ minHeight: 300, borderRadius: 22, background: `url(${catalogItems[0].image}) center/cover` }} />
        </div>
      </section>
      <section id="catalog" style={{ padding: "70px 0", background: theme.card }}>
        <div style={wrap}>
          <div style={{ marginBottom: 28 }}><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Our {theme.catalogLabel}</div><h2 style={{ fontFamily: theme.headlineFont, fontSize: 38, margin: "8px 0" }}>Featured work &amp; services</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
            {catalogItems.map((item) => (
              <a key={item.id} href={`/${slug}/${item.kind}/${item.id}`} style={{ color: ink, textDecoration: "none", background: theme.bg, border: `1px solid ${theme.border || `${ink}18`}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ height: 170, background: `url(${item.image}) center/cover` }} />
                <div style={{ padding: 18 }}><div style={{ fontSize: 10, color: primary, textTransform: "uppercase", letterSpacing: 1 }}>{item.categoryName}</div><h3 style={{ margin: "8px 0", fontSize: 16 }}>{item.name}</h3><p style={{ fontSize: 12, opacity: .65, lineHeight: 1.5 }}>{item.description}</p><strong style={{ display: "block", marginTop: 14 }}>₦{item.price.toLocaleString()}</strong></div>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section style={{ padding: "70px 0" }}>
        <div style={wrap}>
          <h2 style={{ fontFamily: theme.headlineFont, fontSize: 34 }}>What customers say</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18, marginTop: 20 }}>
            {goodReviews.map((review) => <div key={review.id} style={{ border: `1px solid ${theme.border || `${ink}18`}`, borderRadius: 16, padding: 20 }}><div style={{ color: primary }}>★★★★★</div><p style={{ lineHeight: 1.6 }}>{review.comment}</p><small style={{ opacity: .6 }}>{review.author.name}</small></div>)}
          </div>
        </div>
      </section>
      <section style={{ padding: "55px 0", background: theme.surfaceDark || ink, color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", gap: 25, alignItems: "center", flexWrap: "wrap" }}>
          <div><div style={{ color: primary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Stay connected</div><h2 style={{ margin: "8px 0 0", fontFamily: theme.headlineFont }}>Get updates from {store.name}</h2></div>
          <form action={subscribe} style={{ display: "flex", gap: 8 }}><input name="email" type="email" required placeholder="you@example.com" style={{ padding: "12px 15px", borderRadius: 999, border: 0, minWidth: 230 }} /><button type="submit" style={{ padding: "12px 18px", border: 0, borderRadius: 999, background: primary, color: "#fff", fontWeight: 800 }}>Subscribe</button></form>
        </div>
      </section>
      <footer style={{ padding: "28px 0", background: theme.bg, color: ink, opacity: .85 }}><div style={wrap}><strong>{store.name}</strong><span style={{ float: "right", fontSize: 12 }}>Powered by BizNest</span></div></footer>
    </div>
  );
}
