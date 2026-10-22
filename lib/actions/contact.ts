"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/abandoned-checkout-email";
import { logError } from "@/lib/observability/log";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import { validateContactEnquiry, type ContactEnquiryInput } from "@/lib/contact-enquiry";
import type { ActionResult } from "@/types/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

async function clientIpKey() {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Public storefront Contact form. The enquiry lands in the merchant's CRM (a
 * lead plus an activity holding the message), the owner gets a dashboard
 * notification, and an email goes out best-effort. The lead is the source of
 * truth: if saving it fails the visitor is told, rather than being shown a
 * false "sent".
 */
export async function submitContactEnquiry(slug: string, input: ContactEnquiryInput): Promise<ActionResult> {
  const checked = validateContactEnquiry(input);
  if (!checked.ok) {
    // Honeypot hit: look successful to the bot, store nothing.
    if (checked.spam) return { success: true, data: undefined };
    return { success: false, error: checked.error };
  }
  const { name, email, phone, subject, message } = checked.data;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, contactEmail: true, business: { select: { userId: true, email: true } } },
  });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This business isn't accepting messages right now." };

  const [perStore, perIp] = await Promise.all([
    checkRateLimit(`contact:store:${store.id}`, 30, 60 * 60 * 1000),
    checkRateLimit(`contact:ip:${await clientIpKey()}`, 5, 60 * 60 * 1000),
  ]);
  if (!perStore.allowed || !perIp.allowed) return { success: false, error: "Too many messages right now. Please try again a little later." };

  let leadId: string;
  let isNewLead = false;
  try {
    // Re-submitting with the same email while an earlier lead is still open
    // adds to that lead instead of creating a duplicate.
    const existing = await prisma.crmLead.findFirst({ where: { storeId: store.id, email, status: { notIn: ["WON", "LOST"] } } });
    const lead = existing ?? (await prisma.crmLead.create({
      data: { storeId: store.id, name, email, phone, source: "FORM", notes: `Contacted via the website contact form: ${subject}` },
    }));
    leadId = lead.id;
    isNewLead = !existing;
    await prisma.crmActivity.create({ data: { leadId, type: "ENQUIRY", title: `Contact form: ${subject}`.slice(0, 180), body: message } });
  } catch (err) {
    await logError("API", "Contact enquiry save failed", { storeId: store.id, error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: "We couldn't send your message. Please try again in a moment." };
  }

  if (isNewLead) {
    try {
      await runAutomationsForEvent({ type: "CRM_LEAD_CREATED", storeId: store.id, data: { leadId, name, email } });
    } catch (err) {
      await logError("API", "Contact enquiry automation failed", { storeId: store.id, leadId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    await notifyUser({
      userId: store.business.userId,
      type: "CONTACT_ENQUIRY",
      title: `New message from ${name}`,
      body: `${subject}: ${message.slice(0, 140)}`,
      url: `/store/${slug}/admin/apps/crm`,
    });
  } catch (err) {
    await logError("API", "Contact enquiry notification failed", { storeId: store.id, leadId, error: err instanceof Error ? err.message : String(err) });
  }

  const merchantEmail = store.contactEmail?.trim() || store.business.email?.trim();
  if (merchantEmail) {
    try {
      const result = await sendOrderNotificationEmail(
        merchantEmail,
        `New message from ${name}`,
        `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${phone ? `, ${escapeHtml(phone)}` : ""}) wrote about <strong>${escapeHtml(subject)}</strong>:</p><p style="white-space:pre-line">${escapeHtml(message)}</p><p><a href="${APP_URL}/store/${slug}/admin/apps/crm">Open in BizNest CRM</a></p>`
      );
      if (result?.error) void logError("EMAIL", "Contact enquiry email failed", { storeId: store.id, leadId, message: result.error.message });
    } catch (err) {
      await logError("EMAIL", "Contact enquiry email threw", { storeId: store.id, leadId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { success: true, data: undefined };
}
