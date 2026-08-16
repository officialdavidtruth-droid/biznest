import { z } from "zod";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Everything the AI Store Builder can fill in from one business description.
 * Every field here is a *starting draft* the owner reviews and edits before
 * anything goes live — see applyAiStoreDraft in lib/actions/ai-store-builder.ts,
 * which only ever writes to override columns (heroOverrides, storyOverrides,
 * etc.), never publishes anything by itself.
 */
export const storeDraftSchema = z.object({
  storeNameSuggestions: z.array(z.string()).length(3),
  colorPalette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  heroHeadline: z.string(),
  heroSubtitle: z.string(),
  aboutHeading: z.string(),
  aboutBody: z.string(),
  productCategories: z.array(z.string()).min(3).max(8),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(3).max(6),
  seoTitle: z.string(),
  seoDescription: z.string(),
  whatsappCta: z.string(),
  deliveryNote: z.string(),
  sampleProducts: z
    .array(z.object({ name: z.string(), description: z.string(), suggestedPriceNaira: z.number() }))
    .min(3)
    .max(6),
  socialBio: z.string(),
});

export type StoreDraft = z.infer<typeof storeDraftSchema>;

const SYSTEM_PROMPT = `You are BizNest's store-setup assistant. A Nigerian small-business owner describes their business in one or two sentences. You generate a complete starting draft for their online store as strict JSON — nothing else, no markdown fences, no commentary.

Rules:
- Output must be valid JSON matching exactly this shape (all fields required):
{
  "storeNameSuggestions": string[3],
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" },
  "heroHeadline": string,
  "heroSubtitle": string,
  "aboutHeading": string,
  "aboutBody": string (2-3 sentences),
  "productCategories": string[3-8],
  "faq": [{ "question": string, "answer": string }] (3-6 items),
  "seoTitle": string (under 60 chars),
  "seoDescription": string (under 160 chars),
  "whatsappCta": string (short button label, e.g. "Chat with us on WhatsApp"),
  "deliveryNote": string (one sentence, reasonable default for a Nigerian business),
  "sampleProducts": [{ "name": string, "description": string, "suggestedPriceNaira": number }] (3-6 items, realistic Naira prices),
  "socialBio": string (under 150 chars, for Instagram/Twitter bio)
}
- Tone: warm, confident, locally relevant to Nigeria. Never generic filler.
- Prices must be realistic for the Nigerian market for the described product type.
- Never invent a business detail the user didn't imply (e.g. don't claim awards, years in business, or specific locations they didn't mention).`;

export async function generateStoreDraft(businessDescription: string): Promise<
  { success: true; data: StoreDraft } | { success: false; error: string }
> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: "AI Store Builder isn't configured yet (missing ANTHROPIC_API_KEY)." };
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: businessDescription.slice(0, 1000) }],
      }),
    });
  } catch {
    return { success: false, error: "Couldn't reach the AI service. Please try again." };
  }

  if (!res.ok) {
    return { success: false, error: `AI service error (${res.status}). Please try again.` };
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) return { success: false, error: "AI service returned an empty response." };

  let parsed: unknown;
  try {
    // Model is instructed to return raw JSON, but strip fences defensively
    // in case it wraps the output anyway.
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { success: false, error: "Couldn't parse the AI response. Please try again." };
  }

  const result = storeDraftSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "AI response didn't match the expected format. Please try again." };
  }

  return { success: true, data: result.data };
}
