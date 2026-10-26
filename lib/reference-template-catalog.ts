import type { GeneratedTemplate } from "@/lib/template-themes";
import { buildReferenceTheme } from "@/lib/template-themes";
import { REFERENCE_THEME_DATA } from "@/lib/reference-theme-data";

/** Real selectable storefront templates based on the user's supplied design references.
 * The definitions are plain data in lib/reference-theme-data.ts; storefront content always comes from the merchant's data.
 */
export const REFERENCE_TEMPLATE_CATALOG: readonly GeneratedTemplate[] = REFERENCE_THEME_DATA.map(buildReferenceTheme);

export const REFERENCE_TEMPLATE_CATEGORY: Readonly<Record<string, string>> = Object.fromEntries(REFERENCE_THEME_DATA.map((d) => [d.name, d.category]));
