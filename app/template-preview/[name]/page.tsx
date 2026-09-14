import {notFound} from "next/navigation";
import {GRANDEUR_TEMPLATE_NAME,HOTEL_TEMPLATE_NAME,TASTEHOUSE_TEMPLATE_NAME} from "@/lib/template-themes";
import {getTemplateVariant,TEMPLATE_VARIANTS} from "@/lib/template-variants";
import {GrandeurHome} from "@/components/storefront/grandeur-restaurant";
import {ThelusoHotel} from "@/components/storefront/theluso-hotel";
import {DEFAULT_HOTEL_CONTENT} from "@/lib/hotel-content";
import {EXAMPLE_TEMPLATE_NAME} from "@/lib/example-content";
import {ExampleStorefront} from "@/components/storefront/example-store";
import {TasteHouseHome} from "@/components/storefront/tastehouse";
import {getTasteHouseContent} from "@/lib/tastehouse-content";
import {TemplateVariantFrame} from "@/components/storefront/template-variant-frame";
const slug="__biznest-template-preview";
const restaurant={name:"The Grandeur Restaurant",slug,logoUrl:null,bannerUrl:null,storyImage:null,address:"123 Luxury Avenue, Abuja, Nigeria",phone:"+234 803 123 4567",email:"hello@thegrandeurrestaurant.com",business:{description:"Fine dining. Greater moments."}};
const items=["Classic Pancakes","Spring Rolls","Grilled Lagos Pepper Chicken","Grilled Prawns","Grilled Ribeye Steak","Truffle Pasta"].map((name,i)=>({id:`demo-${i}`,kind:"product" as const,name,description:"Signature dish prepared with premium ingredients.",price:6000+i*2000,currency:"NGN",image:null,categoryName:"Signature",type:"PRODUCT",rentalUnit:null,isBookable:false}));
const example={name:"Example",slug,logoUrl:null,bannerUrl:null,business:{description:"Modern technology for everyday life."}};
const exampleItems=["iPhone 16 Pro Max","MacBook Air M3","Sony WH-1000XM5 Headphones","Samsung Galaxy Watch 7","Bose SoundLink Revolve+","Canon EOS R50","AirPods Pro (2nd Gen)","iPad Air (5th Gen)","DJI Mini 3 Drone","PlayStation 5 Console","Nike Air Max 270","Dyson V15 Detect"].map((name,i)=>({id:`example-${i}`,kind:"product" as const,name,description:"Latest technology product.",price:249+i*50,currency:"USD",image:null,categoryName:"Electronics",type:"PHYSICAL",rentalUnit:null,isBookable:false}));
const hotel={id:"__biznest-template-preview-hotel",name:"THELUSO Hotel & Suites",slug,logoUrl:null,bannerUrl:DEFAULT_HOTEL_CONTENT.rooms[0].image,storyImage:DEFAULT_HOTEL_CONTENT.rooms[2].image,address:"Plot 123, Diplomatic Drive, Central Business District, Abuja, Nigeria",phone:"+234 803 123 4567",email:"info@theluso.com"};
export function generateStaticParams(){return [GRANDEUR_TEMPLATE_NAME,HOTEL_TEMPLATE_NAME,TASTEHOUSE_TEMPLATE_NAME,EXAMPLE_TEMPLATE_NAME,...TEMPLATE_VARIANTS.map(v=>v.name)].map(name=>({name}))}
export default async function TemplatePreviewPage({params}:{params:Promise<{name:string}>}){
 const raw=await params;
 const name=decodeURIComponent(raw.name);
 if(name===GRANDEUR_TEMPLATE_NAME)return <GrandeurHome store={restaurant as any} slug={slug} items={items} reviews={[]}/>;
 if(name===HOTEL_TEMPLATE_NAME)return <ThelusoHotel store={hotel} slug={slug} content={DEFAULT_HOTEL_CONTENT}/>;
 if(name===TASTEHOUSE_TEMPLATE_NAME)return <TasteHouseHome store={restaurant as any} slug={slug} items={items as any} content={await getTasteHouseContent(slug)}/>;
 if(name===EXAMPLE_TEMPLATE_NAME)return <ExampleStorefront store={example} slug={slug} items={exampleItems} mode="home"/>;
 const variant=getTemplateVariant(name);
 if(variant){
   const content = variant.family === "hotel" ? <ThelusoHotel store={hotel} slug={slug} content={DEFAULT_HOTEL_CONTENT}/> : variant.family === "restaurant" ? <GrandeurHome store={restaurant as any} slug={slug} items={items} reviews={[]}/> : variant.family === "food" ? <TasteHouseHome store={restaurant as any} slug={slug} items={items as any} content={await getTasteHouseContent(slug)}/> : <ExampleStorefront store={example} slug={slug} items={exampleItems} mode="home"/>;
   return <TemplateVariantFrame name={name}>{content}</TemplateVariantFrame>;
 }
 notFound();
}