import { getCanonicalBusinessType, isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import { getTemplateDefinition, type StorefrontRenderer } from "@/lib/template-registry";
export function resolveStorefrontRenderer(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}):StorefrontRenderer{
 const t=getTemplateDefinition(input.templateName); if(t) return t.renderer;
 const b=getCanonicalBusinessType({businessCategory:input.businessCategory,storeBusinessType:input.storeBusinessType});
 if(isHotelBusiness(b)) return "hotel"; if(isRestaurantBusiness(b)) return "grandeur"; return "builder";
}
export function isHotelStore(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}){return resolveStorefrontRenderer(input)==="hotel";}
export function isStorefrontRenderer(input:{businessCategory?:string|null;storeBusinessType?:string|null;templateName?:string|null}, renderer:StorefrontRenderer){return resolveStorefrontRenderer(input)===renderer;}
