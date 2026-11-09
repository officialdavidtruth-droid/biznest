"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { audienceWhere, isAudience } from "@/lib/platform-email/audience";
import { campaignBodyHtml, processCampaign } from "@/lib/platform-email/run";
import { sendPlatformEmail } from "@/lib/email/send";
import { safeCtaUrl } from "@/lib/platform-email/templates";
import { APP_URL } from "@/lib/constants/app-url";

async function requireAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return (await verifyAdminSession(token)) ? true : false;
}

type CampaignInput = { subject: string; body: string; ctaLabel: string; ctaUrl: string; audience: string };

function validate(input: CampaignInput): string | null {
  if (input.subject.trim().length < 3) return "Add a subject line.";
  if (input.subject.length > 150) return "Keep the subject under 150 characters.";
  if (input.body.trim().length < 10) return "Write the message body.";
  if (input.body.length > 8000) return "The message is too long (8,000 characters max).";
  if ((input.ctaLabel.trim() === "") !== (input.ctaUrl.trim() === "")) return "A button needs both a label and a link, or neither.";
  if (input.ctaUrl.trim() && !safeCtaUrl(input.ctaUrl, APP_URL)) return "The button link must start with https:// or be a path on BizNest like /templates.";
  return null;
}

export async function getAudienceCount(audience: string): Promise<number> {
  if (!(await requireAdmin()) || !isAudience(audience)) return 0;
  return prisma.user.count({ where: audienceWhere(audience) });
}

export async function sendCampaignTest(input: CampaignInput, to: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Admin session expired. Sign in again." };
  const problem = validate(input);
  if (problem) return { success: false, error: problem };
  const email = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid email to send the test to." };
  const res = await sendPlatformEmail({
    userId: "test-preview",
    email,
    subject: `[Test] ${input.subject.trim()}`,
    bodyHtml: campaignBodyHtml({ body: input.body, ctaLabel: input.ctaLabel.trim() || null, ctaUrl: input.ctaUrl.trim() || null }, "there"),
    kind: "platform-campaign-test",
  });
  if (!res.success) return { success: false, error: `Could not send the test: ${res.error}` };
  return { success: true, data: undefined };
}

export async function sendCampaign(input: CampaignInput): Promise<ActionResult<{ id: string; sent: number; remaining: number }>> {
  if (!(await requireAdmin())) return { success: false, error: "Admin session expired. Sign in again." };
  const problem = validate(input);
  if (problem) return { success: false, error: problem };
  if (!isAudience(input.audience)) return { success: false, error: "Choose who should receive this." };

  const campaign = await prisma.platformCampaign.create({
    data: {
      subject: input.subject.trim(),
      body: input.body.trim(),
      ctaLabel: input.ctaLabel.trim() || null,
      ctaUrl: input.ctaUrl.trim() || null,
      audience: input.audience,
      status: "SENDING",
    },
  });
  await prisma.auditLog.create({
    data: { userId: null, action: "PLATFORM_CAMPAIGN_SENT", entity: "PlatformCampaign", entityId: campaign.id, metadata: { audience: input.audience, subject: campaign.subject } },
  });
  const r = await processCampaign(campaign.id);
  revalidatePath("/supaadmin/campaigns");
  return { success: true, data: { id: campaign.id, sent: r.sent, remaining: r.remaining } };
}

export async function sendNextCampaignBatch(campaignId: string): Promise<ActionResult<{ sent: number; remaining: number }>> {
  if (!(await requireAdmin())) return { success: false, error: "Admin session expired. Sign in again." };
  const r = await processCampaign(campaignId);
  revalidatePath("/supaadmin/campaigns");
  return { success: true, data: { sent: r.sent, remaining: r.remaining } };
}
