import {
  GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME,
  TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME,
  RESTORED_LEGACY_TEMPLATE_CATALOG, SIGNATURE_TEMPLATE_CATALOG,
  LEGACY_CATEGORY_BY_NAME, SIGNATURE_CATEGORY_BY_MODE, SIGNATURE_SUPPORTS_BY_MODE,
  type GeneratedTemplate,
} from "@/lib/template-themes";
import { resolveHomeRenderer, type HomeRendererKind } from "@/lib/storefront/resolve-renderer";
import { canonicalizeBusinessType } from "@/lib/business-identity";

export type StorefrontRenderer = "grandeur" | "hotel" | "tastehouse" | "example" | "builder";
/** `renderer` = journey family (used by route guards). `home` = which component draws the homepage (see lib/storefront/resolve-renderer.ts). */
export type TemplateDefinition = { id:string; name:string; category:string; theme:GeneratedTemplate; renderer:StorefrontRenderer; home:HomeRendererKind; aliases:string[]; supports:string[] };

const publicLegacy: TemplateDefinition[] = RESTORED_LEGACY_TEMPLATE_CATALOG.map((theme) => ({
  id: `legacy-${theme.variationName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`,
  name: theme.variationName,
  category: LEGACY_CATEGORY_BY_NAME[theme.variationName] || "Retail",
  theme,
  renderer: "builder",
  home: resolveHomeRenderer(theme.variationName).kind,
  aliases: [],
  supports: [LEGACY_CATEGORY_BY_NAME[theme.variationName] || "Other"],
}));

const publicSignature: TemplateDefinition[] = SIGNATURE_TEMPLATE_CATALOG.map((theme) => ({
  id: `signature-${theme.signatureMode}`,
  name: theme.variationName,
  category: SIGNATURE_CATEGORY_BY_MODE[theme.signatureMode] || "Other",
  theme: { ...theme, tierRank: ["kinetic","maison","hotel","north","forge"].includes(theme.signatureMode) ? 4 : 3 },
  renderer: "builder",
  home: resolveHomeRenderer(theme.variationName).kind,
  aliases: [],
  supports: [...(SIGNATURE_SUPPORTS_BY_MODE[theme.signatureMode] ?? ["*"])],
}));

const compatibility: TemplateDefinition[] = [
  {id:"grandeur-restaurant",name:GRANDEUR_TEMPLATE_NAME,category:"Restaurant",theme:GRANDEUR_THEME,renderer:"grandeur",home:resolveHomeRenderer(GRANDEUR_TEMPLATE_NAME).kind,aliases:["__grandeur__"],supports:["Restaurant"]},
  {id:"veloura-hotel",name:HOTEL_TEMPLATE_NAME,category:"Hotel & Lodging",theme:HOTEL_THEME,renderer:"hotel",home:resolveHomeRenderer(HOTEL_TEMPLATE_NAME).kind,aliases:["__theluso__"],supports:["Hotel & Lodging"]},
  {id:"tastehouse-food",name:TASTEHOUSE_TEMPLATE_NAME,category:"Restaurant",theme:TASTEHOUSE_THEME,renderer:"tastehouse",home:resolveHomeRenderer(TASTEHOUSE_TEMPLATE_NAME).kind,aliases:["__tastehouse__"],supports:["Restaurant","Food & Groceries"]},
  {id:"example-electronics",name:EXAMPLE_TEMPLATE_NAME,category:"Electronics & Retail",theme:EXAMPLE_THEME,renderer:"example",home:resolveHomeRenderer(EXAMPLE_TEMPLATE_NAME).kind,aliases:["__example__"],supports:["Electronics","Fashion","Home & Furniture","Retail"]},
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
const explicitlySupports=(t:TemplateDefinition,b:string)=>t.supports.some(x=>canonicalizeBusinessType(x)===b);
export function isTemplateCompatibleWithBusiness(t:TemplateDefinition,businessType:string|null|undefined){
  if(!businessType)return true;
  const b=canonicalizeBusinessType(businessType);
  if(b==="Other"||t.supports.includes("*")||explicitlySupports(t,b))return true;
  // No template targets this business type (e.g. Church, Logistics): keep the whole
  // catalog available rather than leaving the merchant with an empty gallery.
  return !TEMPLATE_REGISTRY.some((x)=>explicitlySupports(x,b));
}
