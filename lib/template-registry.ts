import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME, TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME, type GeneratedTemplate } from "@/lib/template-themes";
import { canonicalizeBusinessType } from "@/lib/business-identity";
export type StorefrontRenderer="grandeur"|"hotel"|"tastehouse"|"example"|"builder";
export type TemplateDefinition={id:string;name:string;category:string;theme:GeneratedTemplate;renderer:StorefrontRenderer;aliases:string[];supports:string[]};
export const TEMPLATE_REGISTRY:readonly TemplateDefinition[]=[
 {id:"grandeur-restaurant",name:GRANDEUR_TEMPLATE_NAME,category:"Restaurant",theme:GRANDEUR_THEME,renderer:"grandeur",aliases:["__grandeur__"],supports:["Restaurant"]},
 {id:"veloura-hotel",name:HOTEL_TEMPLATE_NAME,category:"Hotel",theme:HOTEL_THEME,renderer:"hotel",aliases:["__theluso__"],supports:["Hotel & Lodging"]},
 {id:"tastehouse-food",name:TASTEHOUSE_TEMPLATE_NAME,category:"Restaurant",theme:TASTEHOUSE_THEME,renderer:"tastehouse",aliases:["__tastehouse__"],supports:["Restaurant","Food & Groceries"]},
 {id:"example-electronics",name:EXAMPLE_TEMPLATE_NAME,category:"Electronics & Retail",theme:EXAMPLE_THEME,renderer:"example",aliases:["__example__"],supports:["Electronics","Fashion","Home & Furniture","Retail"]},
] as const;
export function getTemplateDefinition(value:string|null|undefined){const raw=String(value??"");if(!raw)return null;return TEMPLATE_REGISTRY.find(t=>t.id===raw||t.name===raw||t.aliases.some(a=>raw===a||raw.startsWith(`${a}:`)))??null;}
export function isTemplateCompatibleWithBusiness(t:TemplateDefinition,businessType:string|null|undefined){const b=canonicalizeBusinessType(businessType);return !businessType||b==="Other"||t.supports.some(x=>canonicalizeBusinessType(x)===b);}
