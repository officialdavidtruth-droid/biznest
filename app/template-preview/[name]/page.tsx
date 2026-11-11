import { defaultPhoto } from "@/lib/default-images";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { nicheHeroPhoto, nicheSamplePhoto } from "@/lib/niche-imagery";
import { StoreCategoriesProvider } from "@/components/storefront/store-categories";

export const revalidate = 3600;
export const metadata: Metadata = { title: "BizNest Template Preview", robots: { index: false, follow: false } };

const items = [
  { id:"preview-1", kind:"product" as const, name:"Signature Collection", description:"A featured item presented in the selected template's visual system.", price:45000, currency:"NGN", image:null, categoryName:"Featured", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-2", kind:"product" as const, name:"Premium Selection", description:"Designed to demonstrate real catalog cards and hierarchy.", price:75000, currency:"NGN", image:null, categoryName:"Popular", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-3", kind:"service" as const, name:"Signature Service", description:"A bookable service or enquiry-led offering.", price:120000, currency:"NGN", image:null, categoryName:"Services", type:"SERVICE", rentalUnit:null, isBookable:true },
  { id:"preview-4", kind:"product" as const, name:"Featured Pick", description:"A second catalog example for the production renderer.", price:32000, currency:"NGN", image:null, categoryName:"New", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-5", kind:"product" as const, name:"Editor's Choice", description:"A curated item for the preview gallery.", price:98000, currency:"NGN", image:null, categoryName:"Editor's Choice", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-6", kind:"service" as const, name:"Consultation", description:"A sample consultation or appointment.", price:50000, currency:"NGN", image:null, categoryName:"Consultation", type:"SERVICE", rentalUnit:null, isBookable:true },
];

const categories = [
  { id:"cat-1", name:"Featured", children:[] },
  { id:"cat-2", name:"New Arrivals", children:[] },
  { id:"cat-3", name:"Popular", children:[] },
  { id:"cat-4", name:"Services", children:[] },
] as any;


// Fashion templates previewed with the generic sample items looked like empty grey boxes. These are
// fashion-flavoured samples with self-contained SVG swatches (no external image hosts to break),
// tinted from the template's own palette so each fashion template still looks distinct.
const swatch = (a: string, b: string, label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><text x="400" y="520" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#ffffff" fill-opacity="0.85" letter-spacing="6">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};
function fashionItems(tpl: any, off = 0) {
  const hex = /^#[0-9a-f]{3,8}$/i;
  const a = hex.test(tpl?.accent) ? tpl.accent : "#B56B45";
  const b = hex.test(tpl?.accentSoft) ? tpl.accentSoft : hex.test(tpl?.ink) ? tpl.ink : "#211C1A";
  const base = { kind: "product" as const, currency: "NGN", type: "PRODUCT", rentalUnit: null, isBookable: false };
  return [
    { ...base, id: "preview-1", name: "Linen Co-ord Set", description: "Relaxed two-piece in breathable linen.", price: 48000, image: nicheSamplePhoto("Fashion", 0 + off) ?? swatch(a, b, "CO-ORD"), categoryName: "Women" },
    { ...base, id: "preview-2", name: "Ankara Wrap Dress", description: "Bold print, flattering wrap fit.", price: 36500, image: nicheSamplePhoto("Fashion", 1 + off) ?? swatch(b, a, "DRESS"), categoryName: "Women" },
    { ...base, id: "preview-3", name: "Tailored Blazer", description: "Sharp shoulders, soft lining.", price: 72000, image: nicheSamplePhoto("Fashion", 2 + off) ?? swatch(a, "#1b1b1d", "BLAZER"), categoryName: "Men" },
    { ...base, id: "preview-4", name: "Leather Tote Bag", description: "Roomy everyday carry in full-grain leather.", price: 95000, image: nicheSamplePhoto("Fashion", 3 + off) ?? swatch("#1b1b1d", a, "TOTE"), categoryName: "Accessories" },
    { ...base, id: "preview-5", name: "Classic Low Sneakers", description: "Clean silhouette, cushioned sole.", price: 54000, image: nicheSamplePhoto("Fashion", 4 + off) ?? swatch(b, "#1b1b1d", "SNEAKER"), categoryName: "Footwear" },
    { ...base, id: "preview-6", name: "Silk Head Wrap", description: "Hand-finished silk in a rich tone.", price: 15000, image: nicheSamplePhoto("Fashion", 5 + off) ?? swatch(a, b, "WRAP"), categoryName: "Accessories" },
  ];
}
const fashionCategories = ["Women", "Men", "Accessories", "Footwear"].map((name, i) => ({ id: `cat-${i + 1}`, name, children: [] })) as any;

const store = {
  name: "BizNest Demo Store",
  logoUrl: null,
  bannerUrl: null,
  contactEmail: "hello@biznest.space",
  contactPhone: "+234 800 000 0000",
  sellsProducts: true,
  business: { description: "Browse our catalog and get in touch today." },
};

// Hotel stock photos (from the hotel default set) so previews are not blank grey; one per template so they stay distinguishable.
// Veloura (ThelusoHotel) already ships its own hero photo.
const PREVIEW_HERO_PHOTOS: Record<string, string> = {
  "Maison — Hotel & Stay": defaultPhoto("photo-1540541338287-41700207dee6", 1800),
  "Grand — Hotel & Hospitality": defaultPhoto("photo-1517248135467-4c7edcad34c4", 1800),
  "Aspire Resort": defaultPhoto("photo-1542314831-068cd1dbfeeb", 1800),
  "Larita Luxury Hotel": defaultPhoto("photo-1564501049412-61c2a3083791", 1800),
  "Skyview Hotels & Resorts": defaultPhoto("photo-1520250497591-112f2f40a3f4", 1800),
};


// Without a provider the storefront nav falls back to a retail demo list (Electronics / Fashion / Home & Living),
// which looked wrong on a salon or law-firm template. Give each preview menu names that fit its own niche.
const PREVIEW_MENU: Record<string, string[]> = {
  Beauty: ["Skincare", "Makeup", "Hair", "Services"],
  Electronics: ["Audio", "Phones", "Laptops", "Accessories"],
  Retail: ["New in", "Best sellers", "Deals", "Gifts"],
  Salon: ["Hair", "Nails", "Skin", "Services"],
  Photography: ["Portraits", "Weddings", "Events", "Prints"],
  Agency: ["Services", "Work", "Process", "Pricing"],
  "Professional Services": ["Services", "Packages", "Resources", "Pricing"],
  Cleaning: ["Residential", "Office", "Deep clean", "Packages"],
  Construction: ["Residential", "Commercial", "Renovation", "Quotes"],
  Restaurant: ["Starters", "Mains", "Desserts", "Drinks"],
  "Food & Groceries": ["Fresh produce", "Pantry", "Drinks", "Bakery"],
  Health: ["Consultations", "Checkups", "Lab tests", "Pharmacy"],
  "Health & Fitness": ["Classes", "Memberships", "Coaching", "Shop"],
  "Event Planning": ["Weddings", "Corporate", "Birthdays", "Packages"],
  Logistics: ["Delivery", "Freight", "Pickup", "Track"],
  "HR & Recruitment": ["Hiring", "Talent pool", "Payroll", "Training"],
  "Real Estate": ["Buy", "Rent", "Land", "Shortlets"],
  "Travel & Tourism": ["Flights", "Hotels", "Tours", "Visas"],
  Automotive: ["Cars", "Parts", "Service", "Rentals"],
  "Home & Furniture": ["Living room", "Bedroom", "Kitchen", "Decor"],
  Fashion: ["Women", "Men", "Accessories", "Footwear"],
};
function withPreviewMenu(category: string, node: ReactNode) {
  const names = PREVIEW_MENU[category];
  if (!names) return node;
  return <StoreCategoriesProvider categories={names.map((name, i) => ({ id: `pm-${i}`, name, parentId: null, count: 6 }))}>{node}</StoreCategoriesProvider>;
}


// Sample catalogues per niche, so a grocery template previews groceries and an electronics template previews gadgets
// (the generic "Signature Collection / Premium Selection" names made every template read the same).
type Sample = { name: string; description: string; price: number };
const NICHE_SAMPLES: Record<string, Sample[]> = {
  Electronics: [
    { name: "Studio Wireless Headphones", description: "Active noise cancelling, 40-hour battery.", price: 89000 },
    { name: "Smart Watch Series 5", description: "Heart-rate, GPS and a week of battery.", price: 145000 },
    { name: "UltraSlim Laptop 14\"", description: "16GB RAM, 512GB SSD, all-day battery.", price: 720000 },
    { name: "Pocket Bluetooth Speaker", description: "Waterproof with deep bass.", price: 36000 },
    { name: "Fast-Charge Power Bank", description: "20,000mAh, charges three devices.", price: 24500 },
    { name: "4K Action Camera", description: "Stabilised video, waterproof to 10m.", price: 198000 },
  ],
  "Food & Groceries": [
    { name: "Fresh Farm Vegetable Box", description: "Seasonal vegetables picked this morning.", price: 12500 },
    { name: "Cold-Pressed Orange Juice", description: "No added sugar, 1 litre.", price: 3800 },
    { name: "Sourdough Loaf", description: "Baked fresh every day.", price: 2800 },
    { name: "Free-Range Eggs (30)", description: "From local family farms.", price: 5200 },
    { name: "Premium Basmati Rice 5kg", description: "Long grain, aged for flavour.", price: 14500 },
    { name: "Tropical Fruit Basket", description: "Mango, pineapple, pawpaw and more.", price: 9800 },
  ],
  "Home & Furniture": [
    { name: "Velvet Lounge Sofa", description: "Three-seater with solid oak legs.", price: 485000 },
    { name: "Oak Dining Table", description: "Seats six, easy to assemble.", price: 320000 },
    { name: "Linen Duvet Set", description: "Soft, breathable, queen size.", price: 58000 },
    { name: "Arc Floor Lamp", description: "Warm light, brass finish.", price: 74000 },
    { name: "Woven Storage Baskets", description: "Set of three, handmade.", price: 21000 },
    { name: "Ceramic Vase Trio", description: "Matte glaze in earthy tones.", price: 18500 },
  ],
  Beauty: [
    { name: "Glow Vitamin C Serum", description: "Brightens and evens skin tone.", price: 18500 },
    { name: "Hydrating Face Cream", description: "Lightweight, 24-hour moisture.", price: 14200 },
    { name: "Matte Lipstick Set", description: "Five shades for every day.", price: 16800 },
    { name: "Argan Hair Oil", description: "Smooths and adds shine.", price: 9500 },
    { name: "Gel Manicure", description: "Long-lasting colour, book online.", price: 12000 },
    { name: "Signature Facial", description: "60 minutes, deep cleanse and glow.", price: 25000 },
  ],
  Restaurant: [
    { name: "Smoky Jollof Rice & Chicken", description: "Our signature, with fried plantain.", price: 6500 },
    { name: "Suya Platter", description: "Spiced grilled beef with onions.", price: 8500 },
    { name: "Pepper Soup", description: "Catfish or goat meat, hot and fragrant.", price: 7200 },
    { name: "Grilled Tilapia", description: "Whole fish with yam chips.", price: 11500 },
    { name: "Chin Chin Dessert Bowl", description: "Crunchy, sweet and shareable.", price: 3500 },
    { name: "Zobo Fresh Drink", description: "Hibiscus, ginger and pineapple.", price: 1800 },
  ],
  Salon: [
    { name: "Silk Press & Style", description: "Smooth, shiny finish with heat protection.", price: 25000 },
    { name: "Box Braids", description: "Neat, lightweight braids, 4-5 hours.", price: 45000 },
    { name: "Gel Manicure", description: "Long-lasting colour, nail art available.", price: 12000 },
    { name: "Deep Conditioning Treatment", description: "Restores moisture and shine.", price: 15000 },
    { name: "Bridal Makeup", description: "Trial and wedding day glam.", price: 85000 },
    { name: "Relaxing Facial", description: "Cleanse, massage and mask.", price: 22000 },
  ],
  Cleaning: [
    { name: "Home Deep Clean", description: "Every room, top to bottom.", price: 45000 },
    { name: "Office Cleaning (weekly)", description: "Evening visits, supplies included.", price: 85000 },
    { name: "Sofa & Carpet Shampoo", description: "Stain removal and freshening.", price: 28000 },
    { name: "Post-Construction Clean", description: "Dust, paint and debris cleared.", price: 120000 },
    { name: "Move-In / Move-Out Clean", description: "Leave it spotless.", price: 60000 },
    { name: "Fumigation", description: "Safe pest control, 3-month cover.", price: 35000 },
  ],
  "Professional Services": [
    { name: "Business Strategy Session", description: "90 minutes with a senior advisor.", price: 75000 },
    { name: "Company Registration", description: "CAC filing handled end to end.", price: 55000 },
    { name: "Tax & Accounting Review", description: "Quarterly books, filed on time.", price: 120000 },
    { name: "Contract Drafting", description: "Clear agreements, two revisions.", price: 90000 },
    { name: "Brand Identity Package", description: "Logo, colours and guidelines.", price: 150000 },
    { name: "Monthly Retainer", description: "Ongoing support, priority replies.", price: 250000 },
  ],
  "Real Estate": [
    { name: "3-Bedroom Duplex, Lekki", description: "Gated estate, 24/7 power.", price: 85000000 },
    { name: "2-Bedroom Apartment, Wuse 2", description: "Serviced, close to shops.", price: 45000000 },
    { name: "Land, 600sqm, Abuja", description: "Verified documents, ready to build.", price: 28000000 },
    { name: "Studio Shortlet", description: "Fully furnished, per night.", price: 65000 },
    { name: "4-Bedroom Detached House", description: "Boys' quarters and garden.", price: 120000000 },
    { name: "Office Space, Maitama", description: "Open plan, 40 seats.", price: 9500000 },
  ],
  "Travel & Tourism": [
    { name: "Dubai 5-Day Escape", description: "Flights, hotel and city tour.", price: 980000 },
    { name: "Zanzibar Beach Week", description: "All-inclusive resort stay.", price: 1450000 },
    { name: "Cape Town Explorer", description: "Table Mountain and wine tour.", price: 1250000 },
    { name: "Visa Assistance", description: "Documents checked, appointment booked.", price: 85000 },
    { name: "Obudu Weekend Getaway", description: "Cable car, lodge and meals.", price: 320000 },
    { name: "Airport Pickup", description: "Meet and greet, private car.", price: 40000 },
  ],
  "Health & Fitness": [
    { name: "Monthly Gym Membership", description: "Open 5am to 10pm.", price: 25000 },
    { name: "Personal Training (8 sessions)", description: "A plan built around you.", price: 120000 },
    { name: "HIIT Class Pass", description: "10 high-energy classes.", price: 40000 },
    { name: "Yoga & Stretch", description: "Slow, restoring group classes.", price: 18000 },
    { name: "Nutrition Coaching", description: "Meal plan and weekly check-ins.", price: 55000 },
    { name: "Recovery Massage", description: "60 minutes, deep tissue.", price: 30000 },
  ],
  Agency: [
    { name: "Brand Strategy Sprint", description: "Two weeks to a clear positioning.", price: 450000 },
    { name: "Website Design & Build", description: "Fast, mobile-first, easy to edit.", price: 650000 },
    { name: "Social Media Management", description: "Content, posting and reporting.", price: 180000 },
    { name: "Video Ad Production", description: "Script, shoot and edit.", price: 350000 },
    { name: "SEO Growth Plan", description: "Audit, fixes and monthly reporting.", price: 220000 },
    { name: "Launch Campaign", description: "Everything for a product launch.", price: 800000 },
  ],
  Retail: [
    { name: "Everyday Canvas Tote", description: "Sturdy, washable, fits a laptop.", price: 14500 },
    { name: "Wireless Earbuds", description: "Clear sound, 24-hour case.", price: 32000 },
    { name: "Stoneware Mug Set", description: "Four mugs, dishwasher safe.", price: 12500 },
    { name: "Classic Low Sneakers", description: "Clean silhouette, cushioned sole.", price: 54000 },
    { name: "Scented Soy Candle", description: "Hand-poured, 40-hour burn.", price: 8500 },
    { name: "Linen Throw Blanket", description: "Soft, light and warm.", price: 27000 },
  ],
};
// Templates whose own name says what they sell preview that niche instead of the broad category they are filed under.
const SERVICE_NICHES = new Set(["Salon","Cleaning","Professional Services","Agency","Health & Fitness","Beauty"]);
const PREVIEW_NICHE: Record<string, string> = { "Fresh & Co.": "Food & Groceries", Horizon: "Fashion", "ShopEase General Store": "Retail", "ShopNova Marketplace": "Retail" };
const SAMPLE_REVIEWS = [
  { id: "r1", rating: 5, comment: "Ordered on Monday, delivered Tuesday. Exactly what the photos showed, and the packaging was lovely.", author: { name: "Amaka O." } },
  { id: "r2", rating: 5, comment: "Easy to browse, paid in seconds and tracking worked. I have already ordered again.", author: { name: "Tunde A." } },
  { id: "r3", rating: 4, comment: "Great quality for the price. Support replied on WhatsApp within minutes.", author: { name: "Zainab M." } },
];

export default async function TemplatePreviewPage({ params, searchParams }: { params: Promise<{ name:string }>; searchParams?: Promise<{ niche?: string }> }) {
  let name: string;
  try { name = decodeURIComponent((await params).name); } catch { notFound(); }
  const definition = getTemplateDefinition(name!);
  if (!definition) notFound();
  // Same resolver the live storefront uses, so a preview always matches what a merchant gets.
  const home = resolveHomeRenderer(definition.name);
  // Give each preview its own identity (name, description, hero photo for hotels) so templates are distinguishable.
  const tpl = definition.theme as any;
  // Each template starts its sample photos at a different point in the niche set, so previews side by side never show the same picture.
  const photoOffset = [...definition.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 6;
  // ?niche=Salon previews the template for another business type (used to check how each template reads in each niche).
  const requested = (await searchParams)?.niche;
  const niche = requested && (NICHE_SAMPLES[requested] || PREVIEW_MENU[requested]) ? requested : PREVIEW_NICHE[definition.name] ?? definition.category;
  const previewStore = {
    ...store,
    slug: "__biznest-template-preview",
    name: definition.name.split(" — ")[0],
    bannerUrl: PREVIEW_HERO_PHOTOS[definition.name] ?? nicheSamplePhoto(niche, photoOffset, 1800) ?? nicheHeroPhoto(niche) ?? nicheSamplePhoto(definition.category, photoOffset, 1800) ?? nicheHeroPhoto(definition.category),
    business: { description: tpl.sub || store.business.description, category: niche },
  };
  const isFashion = niche === "Fashion";
  const samples = NICHE_SAMPLES[niche];
  const sampleItems = isFashion ? fashionItems(tpl, photoOffset) : items.map((it, i) => {
    const menu = PREVIEW_MENU[niche] ?? PREVIEW_MENU[definition.category];
    const sample = samples?.[i % samples.length];
    return { ...it, ...(sample ?? {}), kind: (SERVICE_NICHES.has(niche) && i % 3 !== 2 ? "service" : "product") as "product" | "service", type: SERVICE_NICHES.has(niche) ? "SERVICE" : "PRODUCT", image: nicheSamplePhoto(niche, i + photoOffset) ?? nicheSamplePhoto(definition.category, i + photoOffset) ?? it.image, ...(menu ? { categoryName: menu[i % menu.length] } : {}) };
  });
  const p:any = { store: previewStore, slug:"__biznest-template-preview", catalogItems:sampleItems, items:sampleItems, navCategories:isFashion ? fashionCategories : categories, goodReviews:[], reviews:[], avgRating:null, completedOrders:0, trustScore:null, trustChecklist:null, social:{} };
  if (home.kind === "screenshot") return withPreviewMenu(niche, <SignatureScreenshotHome {...p} mode={home.mode} {...home.palette}/>);
  if (home.kind === "hotel") return <ThelusoHotel store={previewStore as any} slug={p.slug} content={await getHotelContent(p.slug, definition.name)}/>;
  const theme = resolveStoreTheme(definition.category, previewStore.name, null, null, definition.name);
  const baseConfig = templateThemeToBuilderConfig({ ...theme, neutral: true }, previewStore.name, previewStore.business.description, previewStore.bannerUrl, previewStore.business as any);
  // Sample copy for the demo only: a real store shows just what its owner types in the editor.
  const NICHE_COPY: Record<string, { chips: { title: string; body: string }[]; promo: { eyebrow: string; heading: string; body: string; cta: string } }> = {
    service: { chips: [{ title: "Verified professionals", body: "Vetted and reviewed" }, { title: "Book in minutes", body: "Pick a time that suits you" }, { title: "Pay securely", body: "Card or bank transfer" }], promo: { eyebrow: "New client offer", heading: "Book this week and save 10%.", body: "A limited number of slots are open. Reserve yours today.", cta: "Book now" } },
    "Travel & Tourism": { chips: [{ title: "Best price promise", body: "We match any quote" }, { title: "Visa support", body: "Documents checked for you" }, { title: "24/7 trip help", body: "A real person, any hour" }], promo: { eyebrow: "Early-bird deal", heading: "Book your December trip now.", body: "Group departures filling fast. Secure your seat with a deposit.", cta: "See departures" } },
    "Food & Groceries": { chips: [{ title: "Same-day delivery", body: "Order before 2pm" }, { title: "Fresh daily", body: "Sourced this morning" }, { title: "Secure payment", body: "Pay your way" }], promo: { eyebrow: "This week", heading: "Fresh deals on weekly favourites.", body: "Selected fruit, vegetables and pantry items at special prices.", cta: "Shop the offer" } },
    Restaurant: { chips: [{ title: "Hot and fresh", body: "Cooked to order" }, { title: "Fast delivery", body: "At your door in 40 minutes" }, { title: "Easy ordering", body: "Pay online or on delivery" }], promo: { eyebrow: "Chef's special", heading: "Family feast, one price.", body: "Jollof, grilled chicken, plantain and drinks for four.", cta: "Order the feast" } },
    "Real Estate": { chips: [{ title: "Verified listings", body: "Documents checked" }, { title: "Free viewings", body: "Book a time that works" }, { title: "Trusted agents", body: "Licensed and reviewed" }], promo: { eyebrow: "New on the market", heading: "Homes listed this week.", body: "Be the first to see new properties in your area.", cta: "View listings" } },
    retail: { chips: [{ title: "Free delivery", body: "On every order" }, { title: "Secure payment", body: "Pay your way" }, { title: "Easy returns", body: "No stress" }], promo: { eyebrow: "Limited offer", heading: "Amazing deals. This week only.", body: "Selected items at special prices while stock lasts.", cta: "Shop the offer" } },
  };
  // Section headings per business type, so a fashion template previewed as a restaurant says "Our menu", not a generic service line.
  const CATALOG_HEAD: Record<string, [eyebrow: string, heading: string, body: string]> = {
    Restaurant: ["Our menu", "Cooked fresh, served hot", "Rice, grills, soups and sides, made to order."],
    Beauty: ["Bestsellers", "Skincare and beauty picks", "Products our customers reorder every month."],
    Salon: ["Services", "Book your next look", "Cuts, colour, braids and treatments with trusted stylists."],
    Electronics: ["Top tech", "Gadgets worth owning", "Phones, audio and accessories with warranty."],
    Fashion: ["New arrivals", "Fresh pieces this week", "Tailored, ready-to-wear and accessories."],
    "Food & Groceries": ["Fresh today", "Groceries picked this morning", "Fruit, vegetables and pantry staples delivered same day."],
    "Home & Furniture": ["Featured", "Pieces for every room", "Sofas, beds, tables and decor, delivered and set up."],
    "Real Estate": ["Listings", "Homes and land available now", "Verified properties with free viewings."],
    Photography: ["Packages", "Shoots for every moment", "Weddings, portraits, events and brand photography."],
    Cleaning: ["Our services", "Spotless results, booked online", "Home, office and deep cleaning by vetted teams."],
    Construction: ["What we build", "Projects from plan to handover", "Building, finishing and renovation with clear quotes."],
    Automotive: ["In stock", "Vehicles and parts", "Inspected, priced clearly, ready to drive."],
    "Health & Fitness": ["Programs", "Classes and memberships", "Train with coaches who track your progress."],
    Health: ["Care", "Appointments and services", "See a professional without the waiting room."],
    "Event Planning": ["Packages", "Events planned end to end", "Weddings, birthdays and corporate events."],
    Logistics: ["Delivery options", "Move anything, anywhere", "Same-day, interstate and international shipping."],
    "Travel & Tourism": ["Featured trips", "Trips ready to book", "Group tours and custom itineraries."],
    Agency: ["Our services", "Work we do for clients", "Strategy, design and campaigns that get results."],
    "Professional Services": ["Our services", "Advice you can act on", "Fixed-scope packages with clear pricing."],
    "HR & Recruitment": ["Services", "Hire and get hired", "Vetted candidates and managed recruitment."],
  };
  const head = CATALOG_HEAD[niche];
  const copy = NICHE_COPY[niche] ?? (SERVICE_NICHES.has(niche) || ["Professional Services", "Agency", "Cleaning", "Salon"].includes(niche) ? NICHE_COPY.service : NICHE_COPY.retail);
  const sampleChips = copy.chips;
  const config = { ...baseConfig, sections: baseConfig.sections.map((sec) => sec.type === "hero" && ["spotlight", "voyage", "market", "glow", "showroom"].includes(sec.settings.heroVariant ?? "") ? { ...sec, settings: { ...sec.settings, items: sampleChips } } : sec.type === "promo" ? { ...sec, settings: { ...sec.settings, eyebrow: copy.promo.eyebrow, heading: copy.promo.heading, body: copy.promo.body, ctaLabel: copy.promo.cta } } : sec.type === "features" ? { ...sec, settings: { ...sec.settings, items: sampleChips } } : sec.type === "catalog" && head ? { ...sec, settings: { ...sec.settings, eyebrow: head[0], heading: head[1], body: head[2] } } : sec) };
  return withPreviewMenu(niche, <BuilderStorefront store={previewStore as any} config={config} catalogItems={sampleItems as any} reviews={SAMPLE_REVIEWS} avgRating={4.8} completedOrders={1240}/>);
}
