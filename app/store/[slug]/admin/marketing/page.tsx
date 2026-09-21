// Route: /store/[slug]/admin/marketing
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarketingEmailComposer } from "@/components/dashboard/marketing-email-composer";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { marketingTemplateName } from "@/lib/email/marketing-templates";
import { buildMarketingBrand, loadMarketingItems } from "@/lib/email/marketing-brand";
import { MarketingAutomationPanel } from "@/components/dashboard/marketing-automation-panel";

export default async function MarketingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return null;
  const store = access.store;

  const [activeSubscribers, unsubscribedCount, subscribers, campaigns, items, automations] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: { not: null } } }),
    prisma.newsletterSubscriber.findMany({ where: { storeId: store.id }, select: { id: true, email: true, createdAt: true, unsubscribedAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailCampaign.findMany({ where: { storeId: store.id }, select: { id: true, subject: true, template: true, status: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    loadMarketingItems(store.id, slug),
    prisma.automation.count({ where: { storeId: store.id, status: "ACTIVE" } }),
  ]);

  const brand = buildMarketingBrand(store);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing Studio</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pick from 17 email designs, then edit every word, colour and picture so each email looks like your business — not a generic BizNest email.</p>
        </div>
        <div className="flex gap-2"><Link href={`/store/${slug}/admin/customize`} className="rounded-lg border px-3 py-2 text-xs font-medium hover:border-primary">Edit brand</Link><Link href={`/store/${slug}`} target="_blank" className="rounded-lg border px-3 py-2 text-xs font-medium hover:border-primary">View website ↗</Link></div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active subscribers" value={activeSubscribers.toLocaleString()} />
        <Stat label="Unsubscribed" value={unsubscribedCount.toLocaleString()} />
        <Stat label="Campaigns sent" value={campaigns.filter((c) => c.status === "SENT" || c.status === "PARTIAL").length.toLocaleString()} />
        <Stat label="Emails delivered" value={campaigns.reduce((n, c) => n + c.sentCount, 0).toLocaleString()} />
        <Stat label="Active automations" value={automations.toLocaleString()} />
      </div>

      <MarketingEmailComposer slug={slug} brand={brand} items={items} activeSubscribers={activeSubscribers} />

      <div className="mt-8"><MarketingAutomationPanel slug={slug} activeCount={automations} /></div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border bg-background p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Subscribers</h2><p className="mt-1 text-xs text-muted-foreground">People who opted into this store&apos;s newsletter.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">{activeSubscribers} active</span></div>
          <div className="max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 border-b bg-muted/60"><tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{subscribers.map((s) => <tr key={s.id} className="border-b last:border-0"><td className="px-3 py-2 font-medium">{s.email}</td><td className="px-3 py-2 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-NG")}</td><td className="px-3 py-2">{s.unsubscribedAt ? <span className="text-muted-foreground">Unsubscribed</span> : <span className="font-medium text-[var(--bn-admin-orange)]">Active</span>}</td></tr>)}{!subscribers.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No subscribers yet. Add the newsletter section to your website to start collecting them.</td></tr>}</tbody></table></div>
        </section>

        <section className="rounded-2xl border bg-background p-5">
          <div className="mb-4"><h2 className="text-sm font-semibold">Campaign history</h2><p className="mt-1 text-xs text-muted-foreground">Every send is recorded here.</p></div>
          <div className="space-y-2">{campaigns.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{c.subject}</p><p className="mt-1 text-[11px] text-muted-foreground">{marketingTemplateName(c.template)} · {new Date(c.createdAt).toLocaleDateString("en-NG")}</p></div><div className="shrink-0 text-right"><p className="text-xs font-semibold">{c.sentCount}/{c.recipientCount}</p><p className={`mt-1 text-[10px] font-semibold ${c.status === "SENT" ? "text-[var(--bn-admin-orange)]" : c.status === "FAILED" ? "text-[var(--bn-admin-danger)]" : "text-[var(--bn-admin-orange)]"}`}>{c.status}</p></div></div>)}{!campaigns.length && <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">Your first campaign will appear here.</div>}</div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-background p-4"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
