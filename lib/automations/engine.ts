import { prisma } from "@/lib/prisma";
import { sendBrandedHtmlEmail } from "@/lib/email/send";
import { buildMarketingBrand } from "@/lib/email/marketing-brand";
import { defaultMarketingContent, renderMarketingEmail, type MarketingTemplateId } from "@/lib/email/marketing-templates";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

type Event = { type: string; storeId: string; data?: Record<string, unknown> };
type Action = {
  type: "NOTIFY_OWNER" | "CREATE_APPROVAL" | "LOG_ACTIVITY" | "EMAIL" | "NOTIFY_STAFF" | "CRM_FOLLOW_UP";
  title?: string;
  body?: string;
  requestType?: string;
  message?: string;
  /** CRM_FOLLOW_UP: how many days from now to schedule the follow-up. */
  days?: number;
  /** EMAIL: which design to render. Falls back to a sensible default per trigger if omitted. */
  template?: string;
  /** EMAIL: merchant-editable copy. Anything left blank falls back to the design's own starter copy. */
  subject?: string;
  headline?: string;
  emailBody?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/** The design + who it's addressed to, per trigger — used when an EMAIL action doesn't specify one. */
const AUTOMATION_EMAIL_DEFAULTS: Record<string, { template: MarketingTemplateId; audience: "subscriber" | "transactional" }> = {
  NEWSLETTER_SUBSCRIBER_CREATED: { template: "welcome", audience: "subscriber" },
  CHECKOUT_ABANDONED: { template: "winback", audience: "transactional" },
  ORDER_COMPLETED: { template: "thankyou", audience: "transactional" },
};

function matches(conditions: unknown, data: Record<string, unknown>) {
  if (!conditions) return true;
  if (!Array.isArray(conditions)) return true;
  return conditions.every((c: any) => data[c.field] === c.equals);
}

async function sendAutomationEmail(event: Event, action: Action): Promise<string> {
  const recipient = typeof event.data?.email === "string" ? event.data.email : null;
  if (!recipient) return "EMAIL_SKIPPED_NO_RECIPIENT";

  const defaults = AUTOMATION_EMAIL_DEFAULTS[event.type];
  const templateId = (action.template || defaults?.template) as MarketingTemplateId | undefined;
  if (!templateId) return "EMAIL_SKIPPED_UNKNOWN_TEMPLATE";

  const store = await prisma.store.findUnique({ where: { id: event.storeId }, include: { business: true } });
  if (!store) return "EMAIL_SKIPPED_NO_STORE";

  // A marketing-only account has no BizNest storefront to have set a
  // logo/description/colours -- if its website is connected, that's the real
  // brand for automated emails too (welcome, abandoned-checkout, thank-you).
  const websiteConnection = await prisma.marketingWebsiteConnection.findUnique({
    where: { storeId: store.id },
    select: { status: true, businessName: true, businessType: true, logoUrl: true, primaryColor: true, secondaryColor: true, description: true, contactEmail: true, contactPhone: true, socialLinks: true },
  });
  const brand = buildMarketingBrand(store, websiteConnection);
  const base = defaultMarketingContent(templateId, brand, []);
  const content = {
    ...base,
    subject: action.subject?.trim() || base.subject,
    headline: action.headline?.trim() || base.headline,
    body: action.emailBody?.trim() || base.body,
    ctaLabel: action.ctaLabel?.trim() || base.ctaLabel,
    ctaUrl: action.ctaUrl?.trim() || base.ctaUrl,
  };

  // A newsletter welcome email goes to a subscriber, so it carries a real unsubscribe
  // link. Abandoned-checkout and thank-you emails are about one specific order, not
  // an ongoing subscription, so they get an order-appropriate footer line instead and
  // no unsubscribe link (there is nothing to unsubscribe from).
  const isSubscriber = (defaults?.audience ?? "transactional") === "subscriber";
  const unsubscribeUrl = isSubscriber ? `${APP_URL}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(event.storeId, recipient))}` : undefined;
  const footerNote = isSubscriber ? undefined : `You are receiving this email because you have an order with ${brand.name}.`;

  const html = renderMarketingEmail(templateId, brand, content, { unsubscribeUrl, showUnsubscribe: isSubscriber, footerNote });
  const result = await sendBrandedHtmlEmail(recipient, content.subject, html, brand.name);
  return result?.error ? "EMAIL_FAILED" : "EMAIL";
}

async function scheduleCrmFollowUp(event: Event, action: Action): Promise<string> {
  const leadId = typeof event.data?.leadId === "string" ? event.data.leadId : null;
  if (!leadId) return "CRM_FOLLOW_UP_SKIPPED_NO_LEAD";
  const days = Number.isFinite(action.days) && (action.days as number) > 0 ? Math.min(action.days as number, 30) : 1;
  const due = new Date();
  due.setDate(due.getDate() + days);
  due.setHours(9, 0, 0, 0);
  const updated = await prisma.crmLead.updateMany({ where: { id: leadId, storeId: event.storeId, nextFollowUpAt: null }, data: { nextFollowUpAt: due } });
  if (updated.count) {
    await prisma.crmActivity.create({ data: { leadId, type: "NOTE", title: "Follow-up scheduled", body: `Automation set a follow-up for ${due.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}.` } });
  }
  return "CRM_FOLLOW_UP";
}

/** Execute only allow-listed internal actions. Never accept arbitrary URLs/code from automation JSON. */
export async function runAutomationsForEvent(event: Event) {
  const automations = await prisma.automation.findMany({ where: { storeId: event.storeId, trigger: event.type, status: "ACTIVE" } });
  const results = [];
  for (const automation of automations) {
    const run = await prisma.automationRun.create({ data: { storeId: event.storeId, automationId: automation.id, status: "RUNNING", event: event as any } });
    try {
      if (!matches(automation.conditions, event.data ?? {})) {
        await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SKIPPED", finishedAt: new Date(), result: { reason: "conditions_not_met" } } });
        results.push({ id: automation.id, status: "SKIPPED" }); continue;
      }
      const actions = Array.isArray(automation.actions) ? automation.actions as Action[] : [];
      const result: string[] = [];
      const store = await prisma.store.findUnique({ where: { id: event.storeId }, select: { name: true, business: { select: { userId: true } } } });
      if (!store) throw new Error("Store not found");
      for (const action of actions) {
        if (action.type === "NOTIFY_OWNER") {
          await prisma.notification.create({ data: { userId: store.business.userId, type: "AUTOMATION", title: action.title ?? automation.name, body: action.body ?? `Automation triggered by ${event.type}.`, url: `/admin/automations` } });
          result.push("NOTIFY_OWNER");
        } else if (action.type === "CREATE_APPROVAL") {
          await prisma.approvalRequest.create({ data: { storeId: event.storeId, title: action.title ?? automation.name, requestType: action.requestType ?? event.type, metadata: event.data as any } });
          result.push("CREATE_APPROVAL");
        } else if (action.type === "LOG_ACTIVITY") {
          await prisma.storeActivityLog.create({ data: { storeId: event.storeId, actorUserId: store.business.userId, actorName: "BizNest Automation", actorEmail: "system", actorRole: "SYSTEM", action: action.title ?? automation.name, metadata: event.data as any } });
          result.push("LOG_ACTIVITY");
        } else if (action.type === "NOTIFY_STAFF") {
          await prisma.notification.create({ data: { userId: store.business.userId, type: "AUTOMATION", title: action.title ?? automation.name, body: action.message ?? action.body ?? `Automation triggered by ${event.type}.`, url: `/admin/automations` } });
          result.push("NOTIFY_STAFF");
        } else if (action.type === "CRM_FOLLOW_UP") {
          result.push(await scheduleCrmFollowUp(event, action));
        } else if (action.type === "EMAIL") {
          result.push(await sendAutomationEmail(event, action));
        }
      }
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date(), result } });
      results.push({ id: automation.id, status: "SUCCESS" });
    } catch (error) {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: error instanceof Error ? error.message : "Automation failed" } });
      results.push({ id: automation.id, status: "FAILED" });
    }
  }
  return results;
}