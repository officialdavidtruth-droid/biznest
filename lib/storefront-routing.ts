import { getCanonicalBusinessType, isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import { getTemplateDefinition, type StorefrontRenderer } from "@/lib/template-registry";
export function resolveStorefrontRenderer(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}):StorefrontRenderer{
 const t=getTemplateDefinition(input.templateName); if(t) return t.renderer;
 const b=getCanonicalBusinessType({businessCategory:input.businessCategory,storeBusinessType:input.storeBusinessType});
 if(isHotelBusiness(b)) return "hotel"; if(isRestaurantBusiness(b)) return "grandeur"; return "builder";
}
export function isHotelStore(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}){
 // A selected hotel template is authoritative even when legacy business metadata is stale.
 // The registry is the source of truth: any template whose homepage is the hotel renderer
 // (e.g. "Aspire Resort", which has no "hotel" in its name) must also get the hotel inner pages.
 if(getTemplateDefinition(input.templateName)?.home==="hotel") return true;
 const name=String(input.templateName??"").toLowerCase();
 if(name.includes("hotel") || name.includes("lodging") || name.includes("grand-vere") || name.includes("grand vere") || name.includes("veloura")) return true;
 // A hotel business always needs its rooms / booking pages, whatever template it picked;
 // those pages are skinned with the chosen template (see lib/hotel-skin.ts).
 if(isHotelBusiness(getCanonicalBusinessType({businessCategory:input.businessCategory,storeBusinessType:input.storeBusinessType}))) return true;
 return resolveStorefrontRenderer(input)==="hotel";
}
export function isStorefrontRenderer(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}, renderer:StorefrontRenderer){return resolveStorefrontRenderer(input)===renderer;}
