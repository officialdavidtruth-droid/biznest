import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME, HOTEL_TEMPLATE_NAME, HOTEL_THEME, TASTEHOUSE_TEMPLATE_NAME, TASTEHOUSE_THEME, EXAMPLE_TEMPLATE_NAME, EXAMPLE_THEME } from "@/lib/template-themes";

export const TEMPLATE_DEFINITIONS = [
  { name: GRANDEUR_TEMPLATE_NAME, category: "Restaurant", theme: GRANDEUR_THEME },
  { name: HOTEL_TEMPLATE_NAME, category: "Hotel", theme: HOTEL_THEME },
  { name: TASTEHOUSE_TEMPLATE_NAME, category: "Restaurant", theme: TASTEHOUSE_THEME },
  { name: EXAMPLE_TEMPLATE_NAME, category: "Electronics & Retail", theme: EXAMPLE_THEME },
] as const;
