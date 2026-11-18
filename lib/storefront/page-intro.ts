/**
 * The short, editable lines at the top of an owner-written page (About, Contact): the small eyebrow label,
 * the heading above the text, and the sub-title under the page title. Stored inside StorePage.content.intro,
 * so no migration is needed. Anything left empty falls back to the template's own default wording.
 */
export type PageIntro = { eyebrow?: string; heading?: string; subtitle?: string };

const LIMITS: Record<keyof PageIntro, number> = { eyebrow: 40, heading: 120, subtitle: 200 };

export function sanitizeIntro(raw: unknown): PageIntro {
  const out: PageIntro = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of Object.keys(LIMITS) as (keyof PageIntro)[]) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+/g, " ").trim().slice(0, LIMITS[key]);
    if (t) out[key] = t;
  }
  return out;
}

export function ownerPageIntro(content: unknown): PageIntro {
  if (!content || typeof content !== "object" || Array.isArray(content)) return {};
  return sanitizeIntro((content as { intro?: unknown }).intro);
}

/** Pages whose built-in layout has these lines. */
export const INTRO_PAGES = new Set(["about", "contact"]);
