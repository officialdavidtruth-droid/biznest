import { getBusinessExperience, type BusinessModelInput, type BusinessMode } from "@/lib/business-experience";
import { TEMPLATE_NAME } from "@/lib/template-themes";

export type TemplateCandidate = { name: string; category: string; config?: unknown };

/**
 * The template registry is intentionally a single-template foundation while
 * the new storefront collection is rebuilt. Only Grandeur is selectable.
 */
export function getTemplateBusinessType(template: TemplateCandidate): string | null {
  if (template.name === TEMPLATE_NAME) return "Restaurant";
  return null;
}

export function getTemplateMode(template: TemplateCandidate): BusinessMode | "unknown" {
  if (template.name === TEMPLATE_NAME || /restaurant|food/i.test(`${template.name} ${template.category}`)) return "service";
  return "unknown";
}

export function isTemplateCompatible(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): boolean {
  if (template.name !== TEMPLATE_NAME) return false;
  const experience = getBusinessExperience(category, model);
  return !category || category.toLowerCase() === "restaurant" || experience.mode === "hybrid";
}

export function templateCompatibilityScore(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): number {
  if (!isTemplateCompatible(template, category, model)) return -100;
  const experience = getBusinessExperience(category, model);
  return getTemplateMode(template) === experience.mode ? 50 : 10;
}
