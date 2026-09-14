export type TemplateFamily = "restaurant" | "hotel" | "food" | "retail";
export type TemplateVariant = { name:string; family:TemplateFamily; category:string; tierRank:1|2|3|4; variant:number; layout:string; description:string };
const make=(family:TemplateFamily,category:string,tierRank:1|2|3|4,names:string[],layouts:string[])=>names.map((name,i)=>({name,family,category,tierRank,variant:i+1,layout:layouts[i],description:name}));
export const TEMPLATE_VARIANTS:TemplateVariant[]=[
 ...make("restaurant","Restaurant",3,["Grandeur — Fine Dining Restaurant","Grandeur — Heritage Dining","Grandeur — Modern Atelier","Grandeur — Midnight Supper Club","Grandeur — Garden Dining"],["editorial","split","asymmetric","cinematic","garden"]),
 ...make("hotel","Hotel",3,["Veloura — Superior Luxury Hotel","Veloura — Grand Residence","Veloura — Urban Luxe","Veloura — Coastal Retreat","Veloura — Modern Palace"],["luxury","residence","urban","coastal","palace"]),
 ...make("food","Restaurant",3,["TasteHouse — Food Delivery","TasteHouse — Street Kitchen","TasteHouse — Fresh Market","TasteHouse — Night Bites","TasteHouse — Family Table"],["street","market","night","family","table"]),
 ...make("retail","Electronics & Retail",2,["Example — Modern Electronics Store","Example — Tech Atelier","Example — Future Lab","Example — Digital Market","Example — Neo Store"],["atelier","lab","market","neo","gallery"]),
];
export function getTemplateVariant(name:string|null|undefined){return TEMPLATE_VARIANTS.find(v=>v.name===name)||null;}
export function getTemplateFamily(name:string|null|undefined){return getTemplateVariant(name)?.family||null;}
