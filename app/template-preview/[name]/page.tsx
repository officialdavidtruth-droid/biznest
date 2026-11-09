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
function fashionItems(tpl: any) {
  const hex = /^#[0-9a-f]{3,8}$/i;
  const a = hex.test(tpl?.accent) ? tpl.accent : "#B56B45";
  const b = hex.test(tpl?.accentSoft) ? tpl.accentSoft : hex.test(tpl?.ink) ? tpl.ink : "#211C1A";
  const base = { kind: "product" as const, currency: "NGN", type: "PRODUCT", rentalUnit: null, isBookable: false };
  return [
    { ...base, id: "preview-1", name: "Linen Co-ord Set", description: "Relaxed two-piece in breathable linen.", price: 48000, image: swatch(a, b, "CO-ORD"), categoryName: "Women" },
    { ...base, id: "preview-2", name: "Ankara Wrap Dress", description: "Bold print, flattering wrap fit.", price: 36500, image: swatch(b, a, "DRESS"), categoryName: "Women" },
    { ...base, id: "preview-3", name: "Tailored Blazer", description: "Sharp shoulders, soft lining.", price: 72000, image: swatch(a, "#1b1b1d", "BLAZER"), categoryName: "Men" },
    { ...base, id: "preview-4", name: "Leather Tote Bag", description: "Roomy everyday carry in full-grain leather.", price: 95000, image: swatch("#1b1b1d", a, "TOTE"), categoryName: "Accessories" },
    { ...base, id: "preview-5", name: "Classic Low Sneakers", description: "Clean silhouette, cushioned sole.", price: 54000, image: swatch(b, "#1b1b1d", "SNEAKER"), categoryName: "Footwear" },
    { ...base, id: "preview-6", name: "Silk Head Wrap", description: "Hand-finished silk in a rich tone.", price: 15000, image: swatch(a, b, "WRAP"), categoryName: "Accessories" },
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
  Cleaning: ["Home", "Office", "Deep clean", "Packages"],
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

export default async function TemplatePreviewPage({ params }: { params: Promise<{ name:string }> }) {
  let name: string;
  try { name = decodeURIComponent((await params).name); } catch { notFound(); }
  const definition = getTemplateDefinition(name!);
  if (!definition) notFound();
  // Same resolver the live storefront uses, so a preview always matches what a merchant gets.
  const home = resolveHomeRenderer(definition.name);
  // Give each preview its own identity (name, description, hero photo for hotels) so templates are distinguishable.
  const tpl = definition.theme as any;
  const previewStore = {
    ...store,
    name: definition.name.split(" — ")[0],
    bannerUrl: PREVIEW_HERO_PHOTOS[definition.name] ?? nicheHeroPhoto(definition.category),
    business: { description: tpl.sub || store.business.description },
  };
  const isFashion = definition.category === "Fashion";
  const sampleItems = isFashion ? fashionItems(tpl) : items.map((it, i) => { const menu = PREVIEW_MENU[definition.category]; return { ...it, image: nicheSamplePhoto(definition.category, i) ?? it.image, ...(menu ? { categoryName: menu[i % menu.length] } : {}) }; });
  const p:any = { store: previewStore, slug:"__biznest-template-preview", catalogItems:sampleItems, items:sampleItems, navCategories:isFashion ? fashionCategories : categories, goodReviews:[], reviews:[], avgRating:null, completedOrders:0, trustScore:null, trustChecklist:null, social:{} };
  if (home.kind === "screenshot") return withPreviewMenu(definition.category, <SignatureScreenshotHome {...p} mode={home.mode} {...home.palette}/>);
  if (home.kind === "hotel") return <ThelusoHotel store={previewStore as any} slug={p.slug} content={await getHotelContent(p.slug, definition.name)}/>;
  const theme = resolveStoreTheme(definition.category, previewStore.name, null, null, definition.name);
  const baseConfig = templateThemeToBuilderConfig({ ...theme, neutral: true }, previewStore.name, previewStore.business.description, previewStore.bannerUrl, previewStore.business as any);
  // Sample copy for the demo only: a real store shows just what its owner types in the editor.
  const sampleChips = [{ title: "Free delivery", body: "On every order" }, { title: "Secure payment", body: "Pay your way" }, { title: "Easy returns", body: "No stress" }];
  const config = { ...baseConfig, sections: baseConfig.sections.map((sec) => sec.type === "hero" && ["spotlight", "voyage", "market", "glow", "showroom"].includes(sec.settings.heroVariant ?? "") ? { ...sec, settings: { ...sec.settings, items: sampleChips } } : sec.type === "promo" ? { ...sec, settings: { ...sec.settings, eyebrow: "Limited offer", heading: "Amazing deals. This week only.", body: "Selected items at special prices while stock lasts.", ctaLabel: "Shop the offer" } } : sec.type === "features" ? { ...sec, settings: { ...sec.settings, items: sampleChips } } : sec) };
  return withPreviewMenu(definition.category, <BuilderStorefront store={previewStore as any} config={config} catalogItems={sampleItems as any} reviews={[]} avgRating={null} completedOrders={0}/>);
}
