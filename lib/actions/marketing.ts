"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { revalidatePath } from "next/cache";
import { sendMarketingEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import type { MarketingTemplateId } from "@/lib/email/marketing-templates";
import type { ActionResult } from "@/types/actions";

const MAX_LENGTHS = {
  subject: 180,
  previewText: 180,
  eyebrow: 60,
  headline: 150,
  body: 2000,
  ctaLabel: 40,
  ctaUrl: 2000,
  imageUrl: 2000,
} as const;

export type MarketingSendInput = {
  template: MarketingTemplateId;
  subject: string;
  previewText?: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string;
  items?: Array<{ name: string; description?: string | null; price?: string | null; imageUrl?: string | null; href?: string | null }>;
};

export async function getMarketingAudience(slug: string) {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { subscribers: [], campaigns: [], error: access.error };

  const [subscribers, campaigns] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where: { storeId: access.store.id },
      select: { id: true, email: true, createdAt: true, unsubscribedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailCampaign.findMany({
      where: { storeId: access.store.id },
      select: { id: true, subject: true, template: true, status: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  return { subscribers, campaigns, error: null };
}

export async function sendMarketingCampaign(slug: string, input: MarketingSendInput): Promise<ActionResult<{ sent: number; failed: number }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in." };

  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };

  // Cap campaign volume per store: at most 5 sends per hour, and never two
  // in the same 60 seconds (guards against double-submit / retried clicks
  // creating duplicate campaigns to the same audience).
  const [hourly, burst] = await Promise.all([
    checkRateLimit(`marketing-send:${access.store.id}:hour`, 5, 60 * 60 * 1000),
    checkRateLimit(`marketing-send:${access.store.id}:burst`, 1, 60 * 1000),
  ]);
  if (!burst.allowed) return { success: false, error: "A campaign was just sent for this store. Please wait a minute before sending another." };
  if (!hourly.allowed) {
    const minutes = Math.ceil((hourly.retryAfterSeconds ?? 3600) / 60);
    return { success: false, error: `You've reached the hourly limit for marketing campaigns. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const subject = input.subject.trim();
  const previewText = input.previewText?.trim();
  const eyebrow = input.eyebrow.trim();
  const headline = input.headline.trim();
  const body = input.body.trim();
  const ctaLabel = input.ctaLabel.trim();
  const ctaUrl = input.ctaUrl.trim();
  const imageUrl = input.imageUrl?.trim();
  if (!subject || !headline || !body || !ctaLabel || !ctaUrl) {
    return { success: false, error: "Subject, headline, message, button label and button URL are required." };
  }
  const tooLong =
    (subject.length > MAX_LENGTHS.subject && "Subject") ||
    (previewText && previewText.length > MAX_LENGTHS.previewText && "Preview text") ||
    (eyebrow.length > MAX_LENGTHS.eyebrow && "Eyebrow") ||
    (headline.length > MAX_LENGTHS.headline && "Headline") ||
    (body.length > MAX_LENGTHS.body && "Message") ||
    (ctaLabel.length > MAX_LENGTHS.ctaLabel && "Button label") ||
    (ctaUrl.length > MAX_LENGTHS.ctaUrl && "Button URL") ||
    (imageUrl && imageUrl.length > MAX_LENGTHS.imageUrl && "Hero image URL");
  if (tooLong) return { success: false, error: `${tooLong} is too long.` };
  input = { ...input, subject, previewText, eyebrow, headline, body, ctaLabel, ctaUrl, imageUrl };

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { storeId: access.store.id, unsubscribedAt: null },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!subscribers.length) return { success: false, error: "There are no active newsletter subscribers yet." };

  const campaign = await prisma.emailCampaign.create({
    data: {
      storeId: access.store.id,
      subject,
      template: input.template,
      previewText: previewText || null,
      content: input,
      status: "SENDING",
      recipientCount: subscribers.length,
    },
  });

  const colors = (access.store.themeColors as Record<string, string> | null) ?? {};
  const brand = {
    name: access.store.name, storeId: access.store.id, slug: access.store.slug, logoUrl: access.store.logoUrl, bannerUrl: access.store.bannerUrl,
    primary: colors.primary ?? colors.accent ?? "#111827", secondary: colors.secondary ?? "#111827",
    accent: colors.accent ?? colors.primary ?? "#2563eb", background: colors.background ?? "#f3f4f6", text: colors.text ?? "#111827",
    fontFamily: access.store.fontFamily ?? "Arial", contactEmail: access.store.contactEmail ?? access.store.business.email,
    contactPhone: access.store.contactPhone ?? access.store.business.phone,
    socialLinks: (access.store.socialLinks as Record<string, string> | null) ?? null, businessType: access.store.businessType,
    businessDescription: access.store.business.description, sellsProducts: access.store.business.sellsProducts, offersServices: access.store.business.offersServices,
  };

  let sent = 0;
  let failed = 0;
  try {
    // Keep concurrency modest so a large list does not overwhelm the mail
    // provider or a serverless function's outbound connections.
    for (let i = 0; i < subscribers.length; i += 10) {
      const chunk = subscribers.slice(i, i + 10);
      const results = await Promise.allSettled(
        chunk.map(({ email }) => sendMarketingEmail({ slug, email, subject, input, brand }))
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) sent += 1;
        else failed += 1;
      }
    }
  } finally {
    // Always record whatever progress was made, even if the loop above
    // threw or the function is about to be killed by a platform timeout —
    // otherwise the campaign is stuck showing "SENDING" forever with no
    // way for the merchant to tell what actually went out.
    const status = sent === 0 && failed === 0 ? "FAILED" : sent === 0 ? "FAILED" : failed === 0 ? "SENT" : "PARTIAL";
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: sent, failedCount: failed, status, sentAt: new Date() },
    });
    revalidatePath(`/store/${slug}/admin/marketing`);
  }

  if (sent === 0) return { success: false, error: "The campaign could not be delivered to any subscriber." };
  return { success: true, data: { sent, failed } };
}
