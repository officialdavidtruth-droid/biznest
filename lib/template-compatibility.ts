import { getBusinessExperience, type BusinessModelInput, type BusinessMode } from "@/lib/business-experience";

export type TemplateCandidate = {
  name: string;
  category: string;
  config?: unknown;
};

const SERVICE_SIGNATURES: Record<string, string[]> = {
  "Hotel & Lodging": ["maison", "hotel"],
  Restaurant: ["ember"],
  Salon: ["muse"],
  Beauty: ["muse"],
  Photography: ["frame"],
  "Professional Services": ["north"],
  Agency: ["north"],
  Cleaning: ["pure"],
  Construction: ["forge"],
};

const SIGNATURE_BUSINESS_TYPE: Record<string, string> = {
  electra: "Electronics", atelier: "Fashion", kinetic: "Fashion", bloom: "Beauty", haven: "Home & Furniture", harvest: "Food & Groceries", maison: "Hotel & Lodging", hotel: "Hotel & Lodging", ember: "Restaurant", muse: "Salon", frame: "Photography", north: "Professional Services", pure: "Cleaning", forge: "Construction",
};

const COMMERCE_SIGNATURES: Record<string, string[]> = {
  Electronics: ["electra"],
  Fashion: ["atelier", "kinetic"],
  "Home & Furniture": ["haven"],
  "Food & Groceries": ["harvest"],
};

function signatureMode(template: TemplateCandidate): string | null {
  const config = template.config as { signatureMode?: unknown } | undefined;
  return typeof config?.signatureMode === "string" ? config.signatureMode : null;
}

export function getTemplateBusinessType(template: TemplateCandidate): string | null {
  const mode = signatureMode(template);
  if (mode && SIGNATURE_BUSINESS_TYPE[mode]) return SIGNATURE_BUSINESS_TYPE[mode];
  return template.category || null;
}

export function getTemplateMode(template: TemplateCandidate): BusinessMode | "unknown" {
  const text = `${template.name} ${template.category}`.toLowerCase();
  const mode = signatureMode(template);
  if (mode && Object.values(SERVICE_SIGNATURES).flat().includes(mode)) return "service";
  if (mode && Object.values(COMMERCE_SIGNATURES).flat().includes(mode)) return "commerce";
  if (/hotel|restaurant|salon|beauty|agency|clean|construction|photography|service|booking|hospitality/i.test(text)) return "service";
  if (/market|commerce|fashion|sneaker|electronics|grocery|furniture|retail|shop|marketplace/i.test(text)) return "commerce";
  return "unknown";
}

export function isTemplateCompatible(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): boolean {
  const experience = getBusinessExperience(category, model);
  const templateMode = getTemplateMode(template);

  if (experience.mode === "hybrid") return templateMode !== "unknown";
  if (templateMode === experience.mode) return true;

  // A niche template is allowed when it belongs to the selected business type,
  // even if its metadata predates the business-mode system.
  const text = `${template.name} ${template.category}`.toLowerCase();
  const niche = (category ?? "").toLowerCase();
  return Boolean(niche && text.includes(niche));
}

export function templateCompatibilityScore(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): number {
  if (!isTemplateCompatible(template, category, model)) return -100;
  const experience = getBusinessExperience(category, model);
  const text = `${template.name} ${template.category}`.toLowerCase();
  let score = 0;
  if (getTemplateMode(template) === experience.mode) score += 10;
  if (category && text.includes(category.toLowerCase())) score += 20;
  const mode = signatureMode(template);
  if (mode && category && (SERVICE_SIGNATURES[category] ?? []).includes(mode)) score += 30;
  if (mode && category && (COMMERCE_SIGNATURES[category] ?? []).includes(mode)) score += 30;
  return score;
}
