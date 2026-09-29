import {
  GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME,
  TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME,
  RESTORED_LEGACY_TEMPLATE_CATALOG, SIGNATURE_TEMPLATE_CATALOG,
  type GeneratedTemplate,
} from "@/lib/template-themes";
import { canonicalizeBusinessType } from "@/lib/business-identity";

export type StorefrontRenderer = "grandeur" | "hotel" | "tastehouse" | "example" | "builder";
export type TemplateDefinition = { id:string; name:string; category:string; theme:GeneratedTemplate; renderer:StorefrontRenderer; aliases:string[]; supports:string[] };

const CATEGORY_BY_NAME: Record<string,string> = {
  "Fresh & Co.": "Retail", "Heenzy Sneaker Co.": "Fashion", "Heenzy — Boutique Rose": "Fashion",
  "Nova Studio — Noir": "Professional Services", "Nova Studio — Ivory Minimal": "Professional Services",
  "Violet": "Retail", "Violet — Sunset": "Retail", "Premium Marketplace": "Retail", "HomeVista": "Real Estate",
  "rRW Premium Rental": "Automotive", "Marketplace Hub": "Retail", "Arcova Architecture": "Professional Services",
  "Rivora Fresh": "Food & Groceries", "JuiceLife": "Food & Groceries", "Fabtex": "Fashion",
};

const publicLegacy: TemplateDefinition[] = RESTORED_LEGACY_TEMPLATE_CATALOG.map((theme) => ({
  id: `legacy-${theme.variationName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`,
  name: theme.variationName,
  category: CATEGORY_BY_NAME[theme.variationName] || "Retail",
  theme,
  renderer: "builder",
  aliases: [],
  supports: [CATEGORY_BY_NAME[theme.variationName] || "Other"],
}));

const signatureCategory: Record<string,string> = {
  electra:"Electronics", atelier:"Fashion", kinetic:"Fashion", bloom:"Beauty", haven:"Home & Furniture", harvest:"Food & Groceries",
  maison:"Hotel & Lodging", hotel:"Hotel & Lodging", ember:"Restaurant", muse:"Salon", frame:"Photography", north:"Agency", pure:"Cleaning", forge:"Construction",
};
const publicSignature: TemplateDefinition[] = SIGNATURE_TEMPLATE_CATALOG.map((theme) => ({
  id: `signature-${theme.signatureMode}`,
  name: theme.variationName,
  category: signatureCategory[theme.signatureMode] || "Other",
  theme: { ...theme, tierRank: ["kinetic","maison","hotel","north","forge"].includes(theme.signatureMode) ? 4 : 3 },
  renderer: "builder",
  aliases: [],
  supports: ["*"],
}));

const compatibility: TemplateDefinition[] = [
  {id:"grandeur-restaurant",name:GRANDEUR_TEMPLATE_NAME,category:"Restaurant",theme:GRANDEUR_THEME,renderer:"grandeur",aliases:["__grandeur__"],supports:["Restaurant"]},
  {id:"veloura-hotel",name:HOTEL_TEMPLATE_NAME,category:"Hotel",theme:HOTEL_THEME,renderer:"hotel",aliases:["__theluso__"],supports:["Hotel & Lodging"]},
  {id:"tastehouse-food",name:TASTEHOUSE_TEMPLATE_NAME,category:"Restaurant",theme:TASTEHOUSE_THEME,renderer:"tastehouse",aliases:["__tastehouse__"],supports:["Restaurant","Food & Groceries"]},
  {id:"example-electronics",name:EXAMPLE_TEMPLATE_NAME,category:"Electronics & Retail",theme:EXAMPLE_THEME,renderer:"example",aliases:["__example__"],supports:["Electronics","Fashion","Home & Furniture","Retail"]},
];

export const TEMPLATE_REGISTRY: readonly TemplateDefinition[] = [...compatibility, ...publicLegacy, ...publicSignature];
export const PUBLIC_TEMPLATE_REGISTRY: readonly TemplateDefinition[] = [...publicLegacy, ...publicSignature];

const normalizeTemplateKey=(v:string)=>v.normalize("NFKC").toLowerCase().replace(/[\u2010-\u2015\u2212]/g,"-").replace(/\s+/g," ").trim();
function safeDecode(v:string){try{return decodeURIComponent(v);}catch{return v;}}

export function getTemplateDefinition(value:string|null|undefined){
  const raw=String(value??""); if(!raw)return null;
  const exact=TEMPLATE_REGISTRY.find(t=>t.id===raw||t.name===raw||t.aliases.some(a=>raw===a||raw.startsWith(`${a}:`)));
  if(exact)return exact;
  // Tolerate URL-encoded input and case/whitespace/dash-style differences.
  const key=normalizeTemplateKey(safeDecode(raw));
  return TEMPLATE_REGISTRY.find(t=>normalizeTemplateKey(t.name)===key||normalizeTemplateKey(t.id)===key)??null;
}
export function isTemplateCompatibleWithBusiness(t:TemplateDefinition,businessType:string|null|undefined){
  if(!businessType)return true;
  const b=canonicalizeBusinessType(businessType);
  return b==="Other" || t.supports.includes("*") || t.supports.some(x=>canonicalizeBusinessType(x)===b);
}