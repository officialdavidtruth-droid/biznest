import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyTemplateHome } from "@/components/storefront/legacy-template-renderer";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";

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

export default async function TemplatePreviewPage({ params }: { params: Promise<{ name:string }> }) {
  let name: string;
  try { name = decodeURIComponent((await params).name); } catch { notFound(); }
  const definition = getTemplateDefinition(name!);
  if (!definition) notFound();
  // Same resolver the live storefront uses, so a preview always matches what a merchant gets.
  const home = resolveHomeRenderer(definition.name);
  const p:any = { store, slug:"__biznest-template-preview", catalogItems:items, items, navCategories:categories, goodReviews:[], reviews:[], avgRating:null, completedOrders:0, trustScore:null, trustChecklist:null, social:{} };
  if (home.kind === "legacy") return <LegacyTemplateHome name={home.name} p={p}/>;
  if (home.kind === "screenshot") return <SignatureScreenshotHome {...p} mode={home.mode} {...home.palette}/>;
  if (home.kind === "example") return <ExampleStorefront store={store} slug={p.slug} items={items as any} mode="home"/>;
  if (home.kind === "hotel") return <ThelusoHotel store={store as any} slug={p.slug} content={await getHotelContent(p.slug)}/>;
  const theme = resolveStoreTheme(definition.category, store.name, null, null, definition.name);
  const config = templateThemeToBuilderConfig(theme, store.name, store.business.description, null);
  return <BuilderStorefront store={store as any} config={config} catalogItems={items as any} reviews={[]} avgRating={null} completedOrders={0}/>;
}
