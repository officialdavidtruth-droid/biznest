import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyTemplateHome } from "@/components/storefront/legacy-template-renderer";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getTemplateDefinition } from "@/lib/template-registry";

export const revalidate = 3600;
export const metadata: Metadata = { title: "BizNest Template Preview", robots: { index: false, follow: false } };

const items = [
  { id:"preview-1", kind:"product" as const, name:"Signature Collection", description:"A featured item presented in the selected template's visual system.", price:45000, currency:"₦", image:null, categoryName:"Featured", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-2", kind:"product" as const, name:"Premium Selection", description:"Designed to demonstrate real catalog cards and hierarchy.", price:75000, currency:"₦", image:null, categoryName:"Popular", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-3", kind:"service" as const, name:"Signature Service", description:"A bookable service or enquiry-led offering.", price:120000, currency:"₦", image:null, categoryName:"Services", type:"SERVICE", rentalUnit:null, isBookable:true },
  { id:"preview-4", kind:"product" as const, name:"Featured Pick", description:"A second catalog example for the production renderer.", price:32000, currency:"₦", image:null, categoryName:"New", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-5", kind:"product" as const, name:"Editor's Choice", description:"A curated item for the preview gallery.", price:98000, currency:"₦", image:null, categoryName:"Editor's Choice", type:"PRODUCT", rentalUnit:null, isBookable:false },
  { id:"preview-6", kind:"service" as const, name:"Consultation", description:"A sample consultation or appointment.", price:50000, currency:"₦", image:null, categoryName:"Consultation", type:"SERVICE", rentalUnit:null, isBookable:true },
];

const categories = [
  { id:"cat-1", name:"Featured", children:[] },
  { id:"cat-2", name:"New Arrivals", children:[] },
  { id:"cat-3", name:"Popular", children:[] },
  { id:"cat-4", name:"Services", children:[] },
] as any;

const store = {
  name: "BizNest Demo Store",
  logoUrl: null,
  bannerUrl: null,
  contactEmail: "hello@biznest.space",
  contactPhone: "+234 800 000 0000",
  sellsProducts: true,
  business: { description: "A production-style preview using the former BizNest storefront design system." },
};

const legacyNames = new Set([
  "Fresh & Co.", "Heenzy Sneaker Co.", "Heenzy — Boutique Rose", "Nova Studio — Noir", "Nova Studio — Ivory Minimal",
  "Violet", "Violet — Sunset", "Premium Marketplace", "HomeVista", "rRW Premium Rental", "Marketplace Hub", "Arcova Architecture",
  "Rivora Fresh", "JuiceLife", "Fabtex",
]);

const signatureMap: Record<string,string> = {
  "Electra — Smart Commerce":"marketplace", "Atelier — Modern Fashion":"fabtex", "Kinetic — Sneaker Drop":"heenzy",
  "Bloom — Beauty Boutique":"belora", "Haven — Home & Furniture":"arcova", "Harvest — Grocery Market":"rivora",
  "Maison — Hotel & Stay":"grand-vere", "Grand — Hotel & Hospitality":"great-treasure", "Ember — Restaurant":"flavora-restaurant",
  "Muse — Salon & Beauty":"belora", "Frame — Photography Studio":"nova", "North — Creative Agency":"arcova",
  "Pure — Cleaning Services":"fresh", "Forge — Construction":"arcova",
};

const palette: Record<string,any> = {
  "great-treasure":{accent:"#E7A928",bg:"#07100D",ink:"#F7F3EA",card:"#101815",muted:"#B9B6AF",border:"#2C362F",accentSoft:"#6D5420",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
  "grand-vere":{accent:"#0E5B45",bg:"#FFFFFF",ink:"#15392C",card:"#FFFFFF",muted:"#777",border:"#E6E1D7",accentSoft:"#C8BEA7",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
  "belora":{accent:"#7B4BC0",bg:"#F1EAF8",ink:"#2B2430",card:"#FFFFFF",muted:"#837B89",border:"#E8E0EF",accentSoft:"#D5B7EA",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
  "flavora-restaurant":{accent:"#F39A0B",bg:"#100A06",ink:"#FFF7EF",card:"#17100C",muted:"#B7A8A1",border:"#352A29",accentSoft:"#8C4722",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
};

export default async function TemplatePreviewPage({ params }: { params: Promise<{ name:string }> }) {
  const name = decodeURIComponent((await params).name);
  if (!getTemplateDefinition(name) && !legacyNames.has(name) && !signatureMap[name] && name !== "Example — Modern Electronics Store" && name !== "Grandeur — Fine Dining Restaurant" && name !== "Veloura — Superior Luxury Hotel" && name !== "TasteHouse — Food Delivery") notFound();
  const p:any = { store, slug:"__biznest-template-preview", catalogItems:items, items, navCategories:categories, goodReviews:[], reviews:[], avgRating:4.8, completedOrders:128, trustScore:null, trustChecklist:null, social:{} };
  if (legacyNames.has(name)) return <LegacyTemplateHome name={name} p={p}/>;
  if (name === "Example — Modern Electronics Store") return <ExampleStorefront store={store} slug={p.slug} items={items as any} mode="home"/>;
  if (name === "Grandeur — Fine Dining Restaurant") return <SignatureScreenshotHome {...p} mode="flavora-restaurant" {...palette["flavora-restaurant"]}/>;
  if (name === "Veloura — Superior Luxury Hotel") return <SignatureScreenshotHome {...p} mode="grand-vere" {...palette["grand-vere"]}/>;
  if (name === "TasteHouse — Food Delivery") return <SignatureScreenshotHome {...p} mode="tastehouse" accent="#F26B21" bg="#FFFBF5" ink="#241608" card="#FFFFFF" muted="#7A6A5D" border="#F1E4D6" accentSoft="#FDE3D3" headlineFont="Poppins, sans-serif" font="Inter, sans-serif"/>;
  const mode=signatureMap[name];
  if (["marketplace","fabtex","heenzy","arcova","rivora","nova","fresh"].includes(mode)) {
    const target=mode === "heenzy" ? "Heenzy Sneaker Co." : mode === "fabtex" ? "Fabtex" : mode === "marketplace" ? "Marketplace Hub" : mode === "arcova" ? "Arcova Architecture" : mode === "rivora" ? "Rivora Fresh" : mode === "nova" ? "Nova Studio — Noir" : "Fresh & Co.";
    return <LegacyTemplateHome name={target} p={p}/>;
  }
  return <SignatureScreenshotHome {...p} mode={mode} {...palette[mode]}/>;
}
