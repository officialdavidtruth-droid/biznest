import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME } from "@/lib/template-themes";
import { HOTEL_TEMPLATE_NAME, HOTEL_THEME, TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME } from "@/lib/template-themes";
import { TEMPLATE_VARIANTS } from "@/lib/template-variants";

export const TEMPLATE_DEFINITIONS=[
 {name:GRANDEUR_TEMPLATE_NAME,category:"Restaurant",theme:GRANDEUR_THEME},
 {name:HOTEL_TEMPLATE_NAME,category:"Hotel",theme:HOTEL_THEME},
 {name:TASTEHOUSE_TEMPLATE_NAME,category:"Restaurant",theme:TASTEHOUSE_THEME},
 {name:EXAMPLE_TEMPLATE_NAME,category:"Electronics & Retail",theme:EXAMPLE_THEME},
 ...TEMPLATE_VARIANTS.filter(v=>![GRANDEUR_TEMPLATE_NAME,HOTEL_TEMPLATE_NAME,TASTEHOUSE_TEMPLATE_NAME,EXAMPLE_TEMPLATE_NAME].includes(v.name)).map(v=>({name:v.name,category:v.category,theme: v.family==="hotel"?HOTEL_THEME:v.family==="retail"?EXAMPLE_THEME:v.family==="food"?TASTEHOUSE_THEME:GRANDEUR_THEME})),
];
