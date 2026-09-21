// Route: /store/[slug]/admin/apps/crm/marketing  (Email marketing lives inside the CRM & Sales app)
import Link from "next/link";
import { Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MarketingWorkspace, type MarketingTab } from "@/components/dashboard/marketing-workspace";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { buildMarketingBrand, loadMarketingItems } from "@/lib/email/marketing-brand";
import { CrmTabs } from "@/components/dashboard/crm-tabs";
import { getPluginEntitlement } from "@/lib/plugins";

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return null;
  const store = access.store;

  // Marketing is part of the CRM & Sales app: same install / plan check as the CRM page.
  const entitlement = await getPluginEntitlement(store.id, "crm");
  if (!entitlement.allowed || !entitlement.installed) {
    return (
      <div className="rounded-3xl border bg-background p-10 text-center">
        <Mail className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">Email marketing</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Email marketing is part of the CRM &amp; Sales app. Install it to design campaigns, manage subscribers and automate follow-ups.</p>
        <Link href={`/store/${slug}/admin/apps`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Apps</Link>
      </div>
    );
  }

  const [activeSubscribers, unsubscribedCount, subscribers, campaigns, items, automations] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: { not: null } } }),
    prisma.newsletterSubscriber.findMany({ where: { storeId: store.id }, select: { id: true, email: true, createdAt: true, unsubscribedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.emailCampaign.findMany({ where: { storeId: store.id }, select: { id: true, subject: true, template: true, status: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, content: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    loadMarketingItems(store.id, slug),
    prisma.automation.count({ where: { storeId: store.id, status: "ACTIVE" } }),
  ]);

  const { tab } = await searchParams;
  const initialTab: MarketingTab = (["compose", "audience", "campaigns", "automations"] as const).find((t) => t === tab) ?? "compose";

  return (
    <div className="space-y-6">
      <CrmTabs slug={slug} active="marketing" />
      <MarketingWorkspace
        slug={slug}
        brand={buildMarketingBrand(store)}
        items={items}
        initialTab={initialTab}
        stats={{
          active: activeSubscribers,
          unsubscribed: unsubscribedCount,
          sentCampaigns: campaigns.filter((c) => c.status === "SENT" || c.status === "PARTIAL").length,
          delivered: campaigns.reduce((n, c) => n + c.sentCount, 0),
          automations,
        }}
        subscribers={subscribers.map((s) => ({ id: s.id, email: s.email, createdAt: s.createdAt.toISOString(), unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null }))}
        campaigns={campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), content: c.content as unknown }))}
      />
    </div>
  );
}
