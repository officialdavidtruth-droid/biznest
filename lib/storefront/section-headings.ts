/**
 * Owner-editable section headings for template-mode stores (the Builder draws the home page from the template + the
 * owner's data). Stored under sectionOverrides.sectionHeadings as { [sectionType]: { heading?, eyebrow? } } so the owner
 * can change generic wording ("Featured", "Browse categories") without publishing a full custom layout.
 */
export const HEADINGS_KEY = "sectionHeadings";
/** Section types whose heading the owner can rename, with the label shown in the editor. */
export const EDITABLE_HEADING_SECTIONS: ReadonlyArray<{ type: string; label: string }> = [
  { type: "categories", label: "Categories" },
  { type: "catalog", label: "Products / services" },
  { type: "about", label: "About" },
  { type: "testimonials", label: "Reviews" },
  { type: "newsletter", label: "Newsletter" },
  { type: "contact", label: "Contact" },
];
export type SectionHeadings = Record<string, { heading?: string; eyebrow?: string }>;
const MAX = 120;

export function normalizeHeadings(value: unknown): SectionHeadings {
  const out: SectionHeadings = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const allowed = new Set(EDITABLE_HEADING_SECTIONS.map((s) => s.type));
  for (const [type, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(type) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const heading = typeof r.heading === "string" ? r.heading.trim().slice(0, MAX) : "";
    const eyebrow = typeof r.eyebrow === "string" ? r.eyebrow.trim().slice(0, MAX) : "";
    if (heading || eyebrow) out[type] = { ...(heading ? { heading } : {}), ...(eyebrow ? { eyebrow } : {}) };
  }
  return out;
}

export function getSectionHeadings(sectionOverrides: unknown): SectionHeadings {
  if (!sectionOverrides || typeof sectionOverrides !== "object" || Array.isArray(sectionOverrides)) return {};
  return normalizeHeadings((sectionOverrides as Record<string, unknown>)[HEADINGS_KEY]);
}

/** Applies the owner's headings over a Builder config's sections (hero is edited elsewhere). */
export function applySectionHeadings<T extends { type: string; settings?: Record<string, unknown> }>(sections: T[], headings: SectionHeadings): T[] {
  return sections.map((sec) => {
    const h = headings[sec.type];
    return h ? { ...sec, settings: { ...sec.settings, ...(h.heading ? { heading: h.heading } : {}), ...(h.eyebrow ? { eyebrow: h.eyebrow } : {}) } } : sec;
  });
}
