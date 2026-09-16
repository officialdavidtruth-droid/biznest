/** Canonical business identity. Business.category is preferred; Store.businessType is a legacy mirror. */
export const CANONICAL_BUSINESS_TYPES = [
  "Fashion","Electronics","Retail","Food & Groceries","Restaurant","Hotel & Lodging","Beauty","Salon","Photography","Professional Services","Agency","Cleaning","Construction","Home & Furniture","Real Estate","Health","Health & Fitness","Automotive","Agriculture","Software Development","Event Planning","Logistics","Church","Other",
] as const;
export type CanonicalBusinessType = (typeof CANONICAL_BUSINESS_TYPES)[number];
const ALIASES: Record<string, CanonicalBusinessType> = {
  restaurant:"Restaurant", restaurants:"Restaurant", food:"Food & Groceries", groceries:"Food & Groceries", "food & groceries":"Food & Groceries",
  hotel:"Hotel & Lodging", hotels:"Hotel & Lodging", lodging:"Hotel & Lodging", "hotel & lodging":"Hotel & Lodging",
  retail:"Retail", ecommerce:"Retail", commerce:"Retail", shop:"Retail", "electronics & retail":"Electronics",
  salon:"Salon", beauty:"Beauty", photography:"Photography", automotive:"Automotive", "real estate":"Real Estate",
  "professional services":"Professional Services", professional:"Professional Services", agency:"Agency", cleaning:"Cleaning", construction:"Construction", "home & furniture":"Home & Furniture", agriculture:"Agriculture", "software development":"Software Development", "event planning":"Event Planning", logistics:"Logistics", church:"Church", health:"Health", "health & fitness":"Health & Fitness",
};
export function canonicalizeBusinessType(value: string | null | undefined): CanonicalBusinessType {
  const raw=String(value??"").trim(); if(!raw) return "Other";
  const exact=CANONICAL_BUSINESS_TYPES.find(x=>x.toLowerCase()===raw.toLowerCase()); if(exact) return exact;
  return ALIASES[raw.toLowerCase()] ?? "Other";
}
export function getCanonicalBusinessType(input:{businessCategory?:string|null;storeBusinessType?:string|null}):CanonicalBusinessType{
  const b=String(input.businessCategory??"").trim(), s=String(input.storeBusinessType??"").trim();
  if(b){const n=canonicalizeBusinessType(b);if(n!=="Other")return n;}
  return canonicalizeBusinessType(s);
}
export function isHotelBusiness(value:string|null|undefined){return canonicalizeBusinessType(value)==="Hotel & Lodging";}
export function isRestaurantBusiness(value:string|null|undefined){return canonicalizeBusinessType(value)==="Restaurant";}
export function isCommerceBusiness(value:string|null|undefined){return ["Fashion","Electronics","Retail","Food & Groceries","Home & Furniture","Agriculture"].includes(canonicalizeBusinessType(value));}
