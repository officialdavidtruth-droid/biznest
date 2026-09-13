/**
 * BizNest storefront template registry.
 *
 * All legacy storefront templates have been removed. This registry contains
 * the approved Grandeur Restaurant and Veloura Hotel foundations. Shared
 * commerce, customer-auth and payment infrastructure remains outside the templates.
 */
export type HeroStyle = "centered" | "split" | "fullbleed";
export type Section = "hero" | "catalog" | "about" | "testimonials" | "contact" | "stats" | "features" | "newsletter" | "categories" | "deal" | "gallery" | "amenities" | "availability" | "map" | "packages";
export type TemplateTheme = {
  bg:string; ink:string; card:string; accent:string; font:string; headlineFont:string; radius:string;
  eyebrow:string; headline:string; sub:string; cta:string; layout:"grid"|"list"; heroStyle:HeroStyle;
  catalogLabel:string; sections:Section[]; muted?:string; border?:string; density?:"compact"|"relaxed"; surfaceDark?:string; accentSoft?:string; professionalMode?:string;
};
export type GeneratedTemplate = TemplateTheme & { variationName:string; tierRank:1|2|3|4 };

export const TEMPLATE_NAME = "Grandeur — Fine Dining Restaurant";
export const GRANDEUR_TEMPLATE_NAME = TEMPLATE_NAME;
export { HOTEL_TEMPLATE_NAME } from "./hotel-content";
export { TASTEHOUSE_TEMPLATE_NAME } from "./tastehouse-content";
export { EXAMPLE_TEMPLATE_NAME } from "./example-content";
import { HOTEL_TEMPLATE_NAME } from "./hotel-content";
import { THELUSO_THEME } from "./hotel-theme";
import { TASTEHOUSE_TEMPLATE_NAME } from "./tastehouse-content";
import { EXAMPLE_TEMPLATE_NAME } from "./example-content";
export const HOTEL_THEME = THELUSO_THEME as unknown as GeneratedTemplate;
export const EXAMPLE_THEME: GeneratedTemplate = { variationName: EXAMPLE_TEMPLATE_NAME, tierRank:2, bg:"#ffffff", ink:"#11131a", card:"#ffffff", accent:"#4b19ff", accentSoft:"#eeeaff", muted:"#697084", border:"#e8e7ef", font:"Inter, sans-serif", headlineFont:"Inter, sans-serif", radius:"12px", eyebrow:"NEW LAUNCH", headline:"Future Technology Today.", sub:"Explore the latest smart devices and innovations.", cta:"Shop Now", layout:"grid", heroStyle:"fullbleed", catalogLabel:"Featured Products", density:"relaxed", surfaceDark:"#05050a", sections:["hero","categories","deal","catalog","features","newsletter"] };
export const TASTEHOUSE_THEME: GeneratedTemplate = {
 variationName:TASTEHOUSE_TEMPLATE_NAME, tierRank:3, bg:"#FFFCF7", ink:"#11151C", card:"#FFFFFF", accent:"#F4511E", accentSoft:"#FFF0E5", muted:"#697386", border:"#EEE7DE", font:"Inter, sans-serif", headlineFont:"Inter, sans-serif", radius:"14px", eyebrow:"GOOD FOOD, GOOD MOOD", headline:"Delicious Food Delivered Fast.", sub:"Discover the best restaurants, cuisines and exclusive offers near you.", cta:"Order Now", layout:"grid", heroStyle:"split", catalogLabel:"Our Menu", density:"relaxed", surfaceDark:"#171717", sections:["hero","categories","catalog","features","deal","newsletter"],
};
export const GRANDEUR_THEME: GeneratedTemplate = {
  variationName:TEMPLATE_NAME, tierRank:3, bg:"#F7F1E8", ink:"#1D1712", card:"#FFFDF9", accent:"#C8944A", accentSoft:"#D9AD68",
  muted:"#746B63", border:"#E7DED3", font:"'Inter', sans-serif", headlineFont:"'Playfair Display', Georgia, serif", radius:"18px",
  eyebrow:"FINE DINING • GREAT COMPANY", headline:"Exceptional Taste, Memorable Moments", sub:"A premium restaurant experience built around dining, reservations, ordering and a complete customer journey.",
  cta:"View Our Menu", layout:"list", heroStyle:"fullbleed", catalogLabel:"Popular Dishes", density:"relaxed", surfaceDark:"#0D0A07",
  sections:["hero","categories","catalog","features","about","gallery","testimonials","contact","newsletter"],
};
export const FRESH = { forest:"#0D0A07", forestDark:"#070504", leaf:GRANDEUR_THEME.accent, leafLight:GRANDEUR_THEME.accentSoft!, mint:GRANDEUR_THEME.bg, mint2:"#EFE6D8", ivory:"#FFFDF9", paper:"#F7F1E8", ink:GRANDEUR_THEME.ink, inkSoft:GRANDEUR_THEME.muted!, citrus:GRANDEUR_THEME.accent, font:GRANDEUR_THEME.font, headlineFont:GRANDEUR_THEME.headlineFont, radius:GRANDEUR_THEME.radius } as const;
export const FRESH_THEME = GRANDEUR_THEME;
export const SIGNATURE_TEMPLATE_CATALOG = [GRANDEUR_THEME] as const;
export const HOTEL_TEMPLATE_CATALOG = [HOTEL_THEME] as const;
export const TASTEHOUSE_TEMPLATE_CATALOG = [TASTEHOUSE_THEME] as const;
export const EXAMPLE_TEMPLATE_CATALOG = [EXAMPLE_THEME] as const;
export const ALL_TEMPLATE_CATALOG = [GRANDEUR_THEME, HOTEL_THEME, TASTEHOUSE_THEME, EXAMPLE_THEME] as const;
export const PROFESSIONAL_SERVICE_TEMPLATE_CATALOG: readonly GeneratedTemplate[] = [];
export const PROFESSIONAL_SERVICE_TEMPLATE_NAMES = new Set<string>();
export function isSignatureTemplate(name:string|null|undefined){return name===TEMPLATE_NAME;}
export function getSignatureTheme(_name:string|null|undefined){return GRANDEUR_THEME;}
export function isProfessionalServicesTemplate(_name:string|null|undefined){return false;}
export function getProfessionalServicesTheme(_name:string|null|undefined){return GRANDEUR_THEME;}
export function getTemplateTheme(category:string|undefined,storeName:string){const c=String(category||"").toLowerCase(); if(c.includes("hotel")||storeName.toLowerCase().includes("hotel"))return HOTEL_THEME; if(c.includes("restaurant")||c.includes("food"))return GRANDEUR_THEME; return GRANDEUR_THEME;}
export function resolveStoreTheme(templateCategory:string|undefined,storeName:string,overrides:{primary?:string;secondary?:string;accent?:string}|null|undefined,fontFamily:string|null|undefined,templateName?:string|null):TemplateTheme{
  const base = templateName===HOTEL_TEMPLATE_NAME || String(templateCategory||"").toLowerCase().includes("hotel") ? HOTEL_THEME : templateName===TASTEHOUSE_TEMPLATE_NAME ? TASTEHOUSE_THEME : templateName===EXAMPLE_TEMPLATE_NAME ? EXAMPLE_THEME : GRANDEUR_THEME;
  return {...base,bg:overrides?.secondary||base.bg,accent:overrides?.primary||overrides?.accent||base.accent,font:fontFamily||base.font};
}
