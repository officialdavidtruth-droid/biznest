"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateStoreDraft, type StoreDraft } from "@/lib/ai/store-builder";
import type { ActionResult } from "@/types/actions";
import { buildIndustryHomepage, getBusinessExperience } from "@/lib/business-experience";

/**
 * Generates a full store draft from a business description. Gated to
 * stores on a plan with features.aiStoreBuilder === true (currently only
 * "Custom AI-Built Store" — see prisma/seed.ts). This only returns the
 * draft; nothing is written to the store until applyAiStoreDraft is called
 * with whatever the owner actually kept after editing.
 */
export async function generateAiStoreDraft(
  slug: string,
  businessDescription: string
): Promise<ActionResult<StoreDraft>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  if (businessDescription.trim().length < 10) {
    return { success: false, error: "Tell us a bit more about your business first." };
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true, subscription: true },
  });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false, error: "You don't have access to this store." };
  }

  const features = (store.subscription?.features ?? {}) as { aiStoreBuilder?: boolean };
  if (!features.aiStoreBuilder) {
    return {
      success: false,
      error: "The AI Store Builder is available on the Custom AI-Built Store plan. Upgrade to use it.",
    };
  }

  // Each generation is a real API cost — cap regenerations so testing/abuse
  // can't run up the bill. 10/hour is generous for genuine iteration.
  const rate = await checkRateLimit(`ai-store-builder:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return {
      success: false,
      error: `Too many generations. Try again in ${Math.ceil((rate.retryAfterSeconds ?? 3600) / 60)} minutes.`,
    };
  }

  const category = store.business.category ?? "Other";
  const contextDescription = `Business category: ${category}. Suggested journey: ${getBusinessExperience(category).journey.join(" -> ")}.\nBusiness description: ${businessDescription}`;
  const result = await generateStoreDraft(contextDescription);
  if (!result.success) return { success: false, error: result.error };

  return { success: true, data: result.data };
}

/**
 * Applies an (owner-edited) draft to the store. Writes only to override /
 * display columns that were always meant to be owner-editable — same
 * columns the manual click-to-edit editors use (heroOverrides,
 * storyOverrides, etc.) — so this is indistinguishable from the owner
 * having typed it in themselves, and remains fully editable afterward.
 * Product categories and sample products are returned as suggestions, not
 * auto-created as real Product rows, since those need images/inventory the
 * AI can't supply.
 */
export async function applyAiStoreDraft(slug: string, draft: StoreDraft): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false, error: "You don't have access to this store." };
  }

  const parsedFaq = draft.faq.map((f) => ({ question: f.question, answer: f.answer }));
  const category = store.business.category ?? "Other";
  const baseBuilder = buildIndustryHomepage(category, store.name, draft.aboutBody);
  const planned = draft.homepagePlan.map((item, index) => ({
    id: index === 0 && item.type === "hero" ? "hero" : `${item.type}-${index}`,
    type: item.type,
    visible: true,
    settings: {
      heading: item.heading,
      body: item.body,
      padding: index === 0 ? "spacious" : "normal",
      columns: item.type === "testimonials" ? 3 : 4,
      ctaLabel: index === 0 ? (draft.businessMode === "commerce" ? "Shop now" : "Get started") : undefined,
      ctaHref: "#catalog",
      image: index === 0 ? (store.bannerUrl || undefined) : undefined,
    },
  }));
  const hasHero = planned.some((s) => s.type === "hero");
  const builder = { ...baseBuilder, sections: hasHero ? planned : [baseBuilder.sections[0], ...planned] };

  await prisma.store.update({
    where: { id: store.id },
    data: {
      themeColors: draft.colorPalette,
      heroOverrides: { headline: draft.heroHeadline, subtitle: draft.heroSubtitle },
      storyOverrides: { heading: draft.aboutHeading, body: draft.aboutBody },
      seoTitle: draft.seoTitle.slice(0, 60),
      seoDescription: draft.seoDescription.slice(0, 160),
      socialLinks: { whatsapp: draft.whatsappCta },
      sectionOverrides: { faq: parsedFaq, deliveryNote: draft.deliveryNote, socialBio: draft.socialBio, builderVersion: 1, builder, order: builder.sections.map((s) => s.id), hidden: [] },
    },
  });

  return { success: true, data: undefined };
}
