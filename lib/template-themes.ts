/**
 * BizNest storefront template registry.
 *
 * All legacy storefront templates have been removed. This registry contains
 * only the approved Grandeur Restaurant foundation. Shared commerce,
 * customer-auth and payment infrastructure remains outside the template.
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
export const PROFESSIONAL_SERVICE_TEMPLATE_CATALOG: readonly GeneratedTemplate[] = [];
export const PROFESSIONAL_SERVICE_TEMPLATE_NAMES = new Set<string>();
export function isSignatureTemplate(name:string|null|undefined){return name===TEMPLATE_NAME;}
export function getSignatureTheme(_name:string|null|undefined){return GRANDEUR_THEME;}
export function isProfessionalServicesTemplate(_name:string|null|undefined){return false;}
export function getProfessionalServicesTheme(_name:string|null|undefined){return GRANDEUR_THEME;}
export function getTemplateTheme(_category:string|undefined,_storeName:string){return GRANDEUR_THEME;}
export function resolveStoreTheme(_templateCategory:string|undefined,_storeName:string,overrides:{primary?:string;secondary?:string;accent?:string}|null|undefined,fontFamily:string|null|undefined,_templateName?:string|null):TemplateTheme{
  return {...GRANDEUR_THEME,bg:overrides?.secondary||GRANDEUR_THEME.bg,accent:overrides?.primary||overrides?.accent||GRANDEUR_THEME.accent,font:fontFamily||GRANDEUR_THEME.font};
}
