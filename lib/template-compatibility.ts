import {
  GRANDEUR_TEMPLATE_NAME,
  HOTEL_TEMPLATE_NAME,
  TASTEHOUSE_TEMPLATE_NAME,
  EXAMPLE_TEMPLATE_NAME,
} from "./template-themes";
import type { BusinessModelInput, BusinessMode } from "./business-experience";
import { resolveBusinessMode } from "./business-experience";
import { TEMPLATE_REGISTRY, getTemplateDefinition, isTemplateCompatibleWithBusiness } from "./template-registry";

export type TemplateCandidate = { name: string; category?: string | null };

export function getTemplateBusinessType(template: TemplateCandidate): string | null {
  const definition = getTemplateDefinition(template.name);
  if (definition) return definition.supports[0] ?? null;
  if (template.name === GRANDEUR_TEMPLATE_NAME || template.name === TASTEHOUSE_TEMPLATE_NAME) return "Restaurant";
  if (template.name === EXAMPLE_TEMPLATE_NAME) return "Retail";
  if (template.name === HOTEL_TEMPLATE_NAME) return "Hotel & Lodging";
  return null;
}

export function getTemplateMode(template: TemplateCandidate): BusinessMode | "unknown" {
  const definition = getTemplateDefinition(template.name);
  if (definition?.renderer === "hotel") return "service";
  if (definition?.renderer === "grandeur" || definition?.renderer === "tastehouse") return "service";
  if (definition?.renderer === "example") return "commerce";
  return "unknown";
}

export function isTemplateCompatible(
  template: TemplateCandidate,
  category?: string | null,
  _model?: BusinessModelInput,
): boolean {
  const definition = getTemplateDefinition(template.name);
  if (!definition) return false;
  return isTemplateCompatibleWithBusiness(definition, category);
}

export function getCompatibleTemplates(businessType: string | null | undefined) {
  return TEMPLATE_REGISTRY.filter((template) => isTemplateCompatibleWithBusiness(template, businessType));
}

export function templateCompatibilityScore(
  template: TemplateCandidate,
  category?: string | null,
  model?: BusinessModelInput,
): number {
  if (!isTemplateCompatible(template, category, model)) return 0;
  let score = 10;
  const mode = resolveBusinessMode(category, model);
  const templateMode = getTemplateMode(template);
  if (templateMode !== "unknown" && (mode === templateMode || mode === "hybrid")) score += 5;
  return score;
}
