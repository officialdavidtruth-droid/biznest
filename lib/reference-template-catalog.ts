import type { GeneratedTemplate } from "@/lib/template-themes";
import { HOTEL_THEME, EXAMPLE_THEME, PREMIUM_THEME, VIOLET_THEME, MARKETPLACE_THEME, HOMEVISTA_THEME, NOVA_THEME } from "@/lib/template-themes";

/** Real selectable storefront templates based on the user's supplied design references.
 * These are theme/config definitions; storefront content always comes from the merchant's data.
 */
const withName = (base: any, variationName: string, category: string, colors: Partial<GeneratedTemplate>, headline: string, sub: string, tierRank: 2 | 3 | 4 = 3): GeneratedTemplate => ({
  ...base, ...colors, variationName, tierRank, eyebrow: category.toUpperCase(), headline, sub,
});

export const REFERENCE_TEMPLATE_CATALOG: readonly GeneratedTemplate[] = [
  withName(HOTEL_THEME, "Aspire Resort", "Hotel & Lodging", { bg: "#21150F", ink: "#F7E8CE", card: "#2C1E16", accent: "#C69A52", accentSoft: "#E2C28A", muted: "#C5B5A2", border: "#5A4030", headlineFont: "Georgia, serif", surfaceDark: "#160E09" }, "Experience Five-Star Luxury", "Unmatched comfort and elegance tailored to your stay.", 4),
  withName(HOTEL_THEME, "Larita Luxury Hotel", "Hotel & Lodging", { bg: "#FFFFFF", ink: "#181716", card: "#FFFFFF", accent: "#B58A69", accentSoft: "#E4D0BC", muted: "#77716D", border: "#E8E3DE", headlineFont: "Georgia, serif", surfaceDark: "#24201D" }, "Luxury hotel in the heart of the city", "Discover modern rooms, thoughtful amenities and personalized hospitality.", 4),
  withName(MARKETPLACE_THEME, "Emarket Furniture & Home", "Home & Furniture", { bg: "#FFFFFF", ink: "#20242A", card: "#FFFFFF", accent: "#E64B3D", accentSoft: "#F9D6D1", muted: "#6B7280", border: "#E5E7EB", surfaceDark: "#202B3B" }, "Make room for better living", "Explore furniture, decor and everyday essentials from this store."),
  withName(EXAMPLE_THEME, "Electra Blue Electronics", "Electronics", { bg: "#F5F8FF", ink: "#0D2455", card: "#FFFFFF", accent: "#155EEF", accentSoft: "#C7D7FE", muted: "#61718B", border: "#D9E4F8", surfaceDark: "#0B2B86" }, "Bring technology to life", "Discover electronics, accessories and smart devices.", 3),
  withName(PREMIUM_THEME, "TechNova Mobile Store", "Electronics", { bg: "#F4F8FF", ink: "#0B1F3A", card: "#FFFFFF", accent: "#075CE5", accentSoft: "#D4E5FF", muted: "#61738B", border: "#DFE8F5", surfaceDark: "#06295D" }, "More power. More possibilities.", "Shop smartphones and accessories with a seamless shopping experience.", 3),
  withName(VIOLET_THEME, "ShopEase General Store", "Retail", { bg: "#FFFFFF", ink: "#202020", card: "#FFFFFF", accent: "#D7193F", accentSoft: "#FCE1E7", muted: "#777777", border: "#EAEAEA", surfaceDark: "#24252B" }, "Big deals on top brands", "Find everyday essentials and new favorites in one place.", 2),
  withName(MARKETPLACE_THEME, "ShopNova Marketplace", "Retail", { bg: "#F8FAFF", ink: "#111827", card: "#FFFFFF", accent: "#174EA6", accentSoft: "#DCE8FC", muted: "#64748B", border: "#E2E8F0", surfaceDark: "#071B3D" }, "Shop more. Save more.", "Browse popular products, categories and new arrivals.", 2),
  withName(EXAMPLE_THEME, "TechVerse Gadgets", "Electronics", { bg: "#FAFAFA", ink: "#161616", card: "#FFFFFF", accent: "#C51D2A", accentSoft: "#F8DADD", muted: "#666666", border: "#E6E6E6", surfaceDark: "#191919" }, "Discover. Shop. Upgrade.", "Explore the latest gadgets and accessories for everyday life.", 3),
  withName(NOVA_THEME, "Wanderly Travel", "Travel & Tourism", { bg: "#F2FAFC", ink: "#12334A", card: "#FFFFFF", accent: "#0B7189", accentSoft: "#C6EDF3", muted: "#5E7784", border: "#D8E9EE", surfaceDark: "#092B3C" }, "Discover your next adventure", "Curated journeys, destinations and experiences for memorable travel.", 3),
  withName(HOTEL_THEME, "Skyview Hotels & Resorts", "Hotel & Lodging", { bg: "#EEF5FC", ink: "#102E4B", card: "#FFFFFF", accent: "#1D638A", accentSoft: "#C4DDEB", muted: "#5D7387", border: "#D7E5F0", headlineFont: "Georgia, serif", surfaceDark: "#0A2338" }, "Your perfect getaway awaits", "Discover rooms, amenities and experiences for an unforgettable stay.", 4),
  withName(HOMEVISTA_THEME, "Nestoria Real Estate", "Real Estate", { bg: "#F8F7FF", ink: "#20194A", card: "#FFFFFF", accent: "#6554D9", accentSoft: "#E0DCFF", muted: "#716D8A", border: "#E8E5F8", surfaceDark: "#241E56" }, "Discover spaces that feel like home", "Explore properties and services to help you find your next home.", 3),
];

export const REFERENCE_TEMPLATE_CATEGORY: Readonly<Record<string, string>> = Object.fromEntries(REFERENCE_TEMPLATE_CATALOG.map((t) => [t.variationName, ({
  "Aspire Resort": "Hotel & Lodging", "Larita Luxury Hotel": "Hotel & Lodging", "Emarket Furniture & Home": "Home & Furniture", "Electra Blue Electronics": "Electronics", "TechNova Mobile Store": "Electronics", "ShopEase General Store": "Retail", "ShopNova Marketplace": "Retail", "TechVerse Gadgets": "Electronics", "Wanderly Travel": "Travel & Tourism", "Skyview Hotels & Resorts": "Hotel & Lodging", "Nestoria Real Estate": "Real Estate",
} as Record<string, string>)[t.variationName] || "Retail"]));
