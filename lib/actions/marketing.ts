"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { revalidatePath } from "next/cache";
import { sendMarketingEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPluginEntitlement } from "@/lib/plugins";
import { getMarketingTemplate, marketingOverLimit, normalizeMarketingContent, type MarketingCampaignInput } from "@/lib/email/marketing-templates";
import type { ActionResult } from "@/types/actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MarketingSendInput = MarketingCampaignInput;

// Email marketing is part of the CRM & Sales app, so it needs the app installed and on the store's plan.
const CRM_REQUIRED = "Email marketing is part of the CRM & Sales app. Install it from Apps to send campaigns.";
async function crmInstalled(storeId: string) {
  const entitlement = await getPluginEntitlement(storeId, "crm");
  return Boolean(entitlement.allowed && entitlement.installed);
}

export async function getMarketingAudience(slug: string) {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { subscribers: [], campaigns: [], error: access.error };
  if (!(await crmInstalled(access.store.id))) return { subscribers: [], campaigns: [], error: CRM_REQUIRED };

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

export async function sendMarketingCampaign(slug: string, input: MarketingSendInput, manualRecipients?: string[]): Promise<ActionResult<{ sent: number; failed: number; invalid: number }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in." };

  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };
  if (!(await crmInstalled(access.store.id))) return { success: false, error: CRM_REQUIRED };

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

  const subject = String(input.subject ?? "").trim();
  const tooLong = marketingOverLimit(input);
  if (tooLong) return { success: false, error: `${tooLong} is too long.` };

  // Re-normalise on the server: clamps every field, drops invalid colours/fonts and
  // caps list sizes, so what is stored and sent never depends on client-side checks.
  const content = normalizeMarketingContent(input);
  const template = getMarketingTemplate(String(input.template)).id;
  // The personal-note design has no headline; every design needs a subject and a message.
  if (!subject || !content.body || (template !== "letter" && !content.headline)) {
    return { success: false, error: template === "letter" ? "Subject and message are required." : "Subject, headline and message are required." };
  }
  const previewText = content.previewText;
  input = { ...content, template, subject };

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { storeId: access.store.id, unsubscribedAt: null },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  // Manual recipients let a merchant reach people who haven't (yet)
  // subscribed via the storefront newsletter form — e.g. a list of past
  // customers or leads pasted in from elsewhere. Validate and dedupe
  // server-side rather than trusting whatever the client sent.
  const seen = new Set(subscribers.map((s) => s.email.toLowerCase()));
  const manualValid: string[] = [];
  let manualInvalidCount = 0;
  for (const raw of manualRecipients ?? []) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      manualInvalidCount += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    manualValid.push(email);
  }

  const recipients = [...subscribers.map((s) => s.email), ...manualValid];
  if (!recipients.length) return { success: false, error: "There are no active newsletter subscribers yet — add at least one manual recipient." };

  const campaign = await prisma.emailCampaign.create({
    data: {
      storeId: access.store.id,
      subject,
      template: input.template,
      previewText: previewText || null,
      content: JSON.parse(JSON.stringify(input)),
      status: "SENDING",
      recipientCount: recipients.length,
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
    for (let i = 0; i < recipients.length; i += 10) {
      const chunk = recipients.slice(i, i + 10);
      const results = await Promise.allSettled(
        chunk.map((email) => sendMarketingEmail({ slug, email, subject, input, brand }))
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
    revalidatePath(`/store/${slug}/admin/apps/crm/marketing`);
  }

  if (sent === 0) return { success: false, error: manualInvalidCount ? `The campaign could not be delivered, and ${manualInvalidCount} entered email${manualInvalidCount === 1 ? " wasn't" : "s weren't"} valid.` : "The campaign could not be delivered to any recipient." };
  return { success: true, data: { sent, failed, invalid: manualInvalidCount } };
}