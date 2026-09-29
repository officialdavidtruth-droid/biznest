import { notFound } from "next/navigation";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { GrandeurHome } from "@/components/storefront/grandeur-restaurant";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { TasteHouseHome } from "@/components/storefront/tastehouse";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { DEFAULT_HOTEL_CONTENT } from "@/lib/hotel-content";
import { getTasteHouseContent } from "@/lib/tastehouse-content";
import { getExampleContent } from "@/lib/example-content";
import { getTemplateDefinition, PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";

const slug="__biznest-template-preview";
const baseStore={name:"BizNest Template Preview",slug,logoUrl:null,bannerUrl:null,contactEmail:"hello@biznest.space",contactPhone:"+234 800 000 0000",business:{description:"A live preview powered by the same storefront renderer used by merchants.",category:"Retail",sellsProducts:true,offersServices:true}};
const items=["Featured Collection","Signature Product","Everyday Essential","Premium Package","New Arrival","Customer Favourite","Limited Edition","Starter Bundle"].map((name,i)=>({id:`demo-${i}`,kind:"product" as const,name,description:"Preview item shown using the selected template's live renderer.",price:25000+i*5000,currency:"NGN",image:null,categoryName:["Featured","New","Popular"][i%3],type:"PRODUCT",rentalUnit:null,isBookable:false}));

export function generateStaticParams(){return PUBLIC_TEMPLATE_REGISTRY.map(t=>({name:t.name}));}

export default async function TemplatePreviewPage({params}:{params:Promise<{name:string}>}){
 const {name:rawName}=await params;
 // Next hands dynamic params back still percent-encoded for names containing
 // spaces / non-ASCII (e.g. "Nova%20Studio%20%E2%80%94%20Noir"). Callers use
 // encodeURIComponent(t.name), so decode before matching against the registry
 // — without this every template with a space or em dash 404s.
 let name=rawName; try{name=decodeURIComponent(rawName);}catch{}
 const definition=getTemplateDefinition(name);
 if(!definition)notFound();
 if(definition.renderer==="grandeur") return <GrandeurHome store={{...baseStore,name:"The Grandeur Restaurant",business:{...baseStore.business,description:"Fine dining. Greater moments.",category:"Restaurant"}} as any} slug={slug} items={items} reviews={[]}/>;
 if(definition.renderer==="hotel") return <ThelusoHotel store={{id:"preview-hotel",...baseStore,name:"THELUSO Hotel & Suites",bannerUrl:DEFAULT_HOTEL_CONTENT.rooms[0].image,address:"Abuja, Nigeria"} as any} slug={slug} content={DEFAULT_HOTEL_CONTENT}/>;
 if(definition.renderer==="tastehouse") return <TasteHouseHome store={{...baseStore,name:"TasteHouse",business:{...baseStore.business,description:"Good food, good mood.",category:"Restaurant"}} as any} slug={slug} items={items} content={await getTasteHouseContent(slug)}/>;
 if(definition.renderer==="example") return <ExampleStorefront store={{...baseStore,name:"Example Electronics",business:{...baseStore.business,category:"Electronics"}} as any} slug={slug} items={items} mode="home" content={await getExampleContent(slug) as any}/>;
 const previewStore={...baseStore,name:definition.name.split(" — ")[0]};
 const theme=resolveStoreTheme(definition.category,previewStore.name,null,null,definition.name);
 const config=templateThemeToBuilderConfig(theme,previewStore.name,previewStore.business.description,previewStore.bannerUrl);
 return <BuilderStorefront store={previewStore as any} config={config} catalogItems={items} reviews={[]} avgRating={4.8} completedOrders={128}/>;
}