import { getBusinessExperience, type BusinessModelInput, type BusinessMode } from "@/lib/business-experience";

export type TemplateCandidate = {
  name: string;
  category: string;
  config?: unknown;
};

const SERVICE_SIGNATURES: Record<string, string[]> = {
  "Hotel & Lodging": ["maison", "hotel", "great-treasure", "grand-vere"],
  Restaurant: ["ember", "tastehouse", "flavora-kitchen", "flavora-restaurant"],
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
  "great-treasure": "Hotel & Lodging", "grand-vere": "Hotel & Lodging", belora: "Beauty", tastehouse: "Restaurant", "flavora-kitchen": "Restaurant", "flavora-restaurant": "Restaurant",
};


const PROFESSIONAL_MODE_TO_NICHE: Record<string,string> = {
  "graphic-design":"Graphic Design & Printing", "branding-agency":"Branding & Brand Identity", "marketing-agency":"Marketing & Digital Agency",
  "photography-studio":"Photography & Visual Production", consulting:"Consulting & Advisory", accounting:"Accounting & Finance", legal:"Legal Services",
  "hr-recruitment":"HR & Recruitment", "web-development":"Web & Software Development", "it-services":"IT & Technology Services",
  architecture:"Architecture & Interior Design", engineering:"Engineering Services", "construction-company":"Construction & Building",
};

const COMMERCE_SIGNATURES: Record<string, string[]> = {
  Electronics: ["electra"],
  Fashion: ["atelier", "kinetic"],
  "Home & Furniture": ["haven"],
  "Food & Groceries": ["harvest"],
  Beauty: ["bloom", "belora"],
};

function signatureMode(template: TemplateCandidate): string | null {
  const config = template.config as { signatureMode?: unknown } | undefined;
  return typeof config?.signatureMode === "string" ? config.signatureMode : null;
}

export function getTemplateBusinessType(template: TemplateCandidate): string | null {
  const mode = signatureMode(template);
  if (mode && PROFESSIONAL_MODE_TO_NICHE[mode]) return PROFESSIONAL_MODE_TO_NICHE[mode];
  if (mode && SIGNATURE_BUSINESS_TYPE[mode]) return SIGNATURE_BUSINESS_TYPE[mode];
  return template.category || null;
}

export function getTemplateMode(template: TemplateCandidate): BusinessMode | "unknown" {
  const text = `${template.name} ${template.category}`.toLowerCase();
  const mode = signatureMode(template);
  if (mode && PROFESSIONAL_MODE_TO_NICHE[mode]) return "service";
  if (mode && Object.values(SERVICE_SIGNATURES).flat().includes(mode)) return "service";
  if (mode && Object.values(COMMERCE_SIGNATURES).flat().includes(mode)) return "commerce";
  if (/hotel|restaurant|salon|beauty|agency|clean|construction|photography|service|booking|hospitality/i.test(text)) return "service";
  if (/market|commerce|fashion|sneaker|electronics|grocery|furniture|retail|shop|marketplace/i.test(text)) return "commerce";
  return "unknown";
}

export function isTemplateCompatible(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): boolean {
  const experience = getBusinessExperience(category, model);
  const templateMode = getTemplateMode(template);
  const mode = signatureMode(template);
  const niche = (category ?? "").toLowerCase();

  // Signature templates are deliberately niche-specific. Do not let a generic
  // same-mode check make a hotel, restaurant, salon, etc. appear compatible
  // with every other service business. This is especially important for
  // commerce/service variants such as Beauty, where the same category can
  // legitimately sell products, offer services, or do both.
  if (mode) {
    const signatureBusinessType = SIGNATURE_BUSINESS_TYPE[mode];
    const professionalNiche = PROFESSIONAL_MODE_TO_NICHE[mode];

    if (signatureBusinessType) {
      const signatureCategory = signatureBusinessType.toLowerCase();
      if (niche !== signatureCategory) return false;
      return experience.mode === "hybrid" || templateMode === experience.mode;
    }

    if (professionalNiche) {
      const matchesProfessional = niche === "professional services" || niche === professionalNiche.toLowerCase();
      if (!matchesProfessional) return false;
      return experience.mode === "hybrid" || templateMode === experience.mode;
    }
  }

  if (experience.mode === "hybrid") return templateMode !== "unknown";
  if (templateMode === experience.mode) return true;

  // Generic templates may still be selected when their metadata explicitly
  // names the business category.
  const text = `${template.name} ${template.category}`.toLowerCase();
  if (niche && text.includes(niche)) return true;
  return false;
}

export function templateCompatibilityScore(template: TemplateCandidate, category?: string | null, model?: BusinessModelInput): number {
  if (!isTemplateCompatible(template, category, model)) return -100;
  const experience = getBusinessExperience(category, model);
  const text = `${template.name} ${template.category}`.toLowerCase();
  let score = 0;
  if (getTemplateMode(template) === experience.mode) score += 10;
  if (category && text.includes(category.toLowerCase())) score += 20;
  const mode = signatureMode(template);
  if (mode && category && PROFESSIONAL_MODE_TO_NICHE[mode] && (category.toLowerCase() === "professional services" || PROFESSIONAL_MODE_TO_NICHE[mode].toLowerCase() === category.toLowerCase())) score += 35;
  if (mode && category && (SERVICE_SIGNATURES[category] ?? []).includes(mode)) score += 30;
  if (mode && category && (COMMERCE_SIGNATURES[category] ?? []).includes(mode)) score += 30;
  return score;
}
