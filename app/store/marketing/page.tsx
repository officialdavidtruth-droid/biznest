import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getMarketingToolAccess } from "@/lib/access/marketing-tool";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { buildMarketingBrand, loadMarketingItems } from "@/lib/email/marketing-brand";
import { MarketingWorkspace, type MarketingTab } from "@/components/dashboard/marketing-workspace";
import { MarketingContactImporter } from "@/components/marketing/marketing-contact-importer";
import { CrmWorkspace } from "@/components/dashboard/crm-workspace";
import { getCrmDashboard } from "@/lib/actions/seo-crm";
import { WebsiteConnector } from "@/components/marketing/website-connector";
import { SignOutButton } from "@/components/forms/sign-out-button";

export default async function StandaloneMarketingDashboard({
  searchParams,
}: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  const access = await getMarketingToolAccess(session?.user?.id);
  if (access.status === "signed-out") redirect("/login?callbackUrl=%2Fstore%2Fmarketing");
  if (access.status !== "active") redirect(access.storeSlug ? `/marketing/select-plan?slug=${encodeURIComponent(access.storeSlug)}` : "/marketing/signup");

  const perm = await assertStorePermission(access.storeSlug, "customers");
  if (!perm.success) redirect("/marketing");
  const store = perm.store;
  const [{ tab }, crm, activeSubscribers, unsubscribedCount, subscribers, campaigns, items, automations, websiteConnection, websiteItems] = await Promise.all([
    searchParams,
    getCrmDashboard(access.storeSlug),
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: { not: null } } }),
    prisma.newsletterSubscriber.findMany({ where: { storeId: store.id }, select: { id: true, email: true, createdAt: true, unsubscribedAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.emailCampaign.findMany({ where: { storeId: store.id }, select: { id: true, subject: true, template: true, status: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, content: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    loadMarketingItems(store.id, access.storeSlug),
    prisma.automation.count({ where: { storeId: store.id, status: "ACTIVE" } }),
    prisma.marketingWebsiteConnection.findUnique({ where: { storeId: store.id }, select: { websiteUrl: true, websiteHost: true, status: true, verificationToken: true, businessName: true, businessType: true, logoUrl: true, primaryColor: true, secondaryColor: true, lastScannedAt: true } }),
    prisma.marketingCatalogItem.findMany({ where: { storeId: store.id, isActive: true }, select: { id: true, type: true, name: true, category: true, imageUrl: true, price: true, salePrice: true, currency: true, url: true, isActive: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  const initialTab: MarketingTab = (["compose", "audience", "campaigns", "automations"] as const).find((t) => t === tab) ?? "compose";
  const pipeline = crm?.success ? crm.data : { leads: [], customerCount: 0, wonCount: 0, wonValue: 0, pipeline: [] };
  // Once ownership of a website is verified, let the workspace adopt its
  // brand (name, logo, colors) instead of the generic account defaults.
  const verifiedBrand = websiteConnection?.status === "CONNECTED" ? websiteConnection : null;
  const displayName = verifiedBrand?.businessName || store.business.businessName;
  const heroStyle = verifiedBrand?.primaryColor
    ? { background: `linear-gradient(135deg, ${verifiedBrand.secondaryColor || "#063b25"}, ${verifiedBrand.primaryColor})` }
    : undefined;

  return (
    <main className="min-h-screen bg-[#f7fbf8] text-[#102a1c]" style={{ "--primary": "142 70% 35%", "--primary-foreground": "0 0% 100%" } as CSSProperties}>
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            {verifiedBrand?.logoUrl && <img src={verifiedBrand.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />}
            <div><Link href="/marketing" className="text-xl font-black">BizNest <span className="text-emerald-600">Marketing</span></Link><p className="mt-0.5 text-xs text-slate-500">{displayName} · {verifiedBrand?.businessType || store.businessType}</p></div>
          </div>
          <div className="flex items-center gap-2"><Link href="/marketing" className="rounded-xl border px-3 py-2 text-sm font-semibold">Marketing home</Link><SignOutButton callbackUrl="/marketing" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Sign out</SignOutButton></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7">
        <section className="rounded-[2rem] bg-gradient-to-br from-[#063b25] via-[#0a6b3a] to-[#23a455] p-7 text-white shadow-xl" style={heroStyle}>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-100">Business growth workspace</p><h1 className="mt-2 text-4xl font-black">Good to see you, {displayName}.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Your CRM, Customer 360, email marketing and automated follow-ups live together here. Your storefront is not required.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Leads",pipeline.leads.length],["Customers",pipeline.customerCount],["Won deals",pipeline.wonCount],["Won value",`₦${Number(pipeline.wonValue).toLocaleString()}`]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-[11px] text-emerald-100">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}
            </div>
          </div>
        </section>

        <WebsiteConnector initial={websiteConnection ? { ...websiteConnection, lastScannedAt: websiteConnection.lastScannedAt?.toISOString() ?? null } : null} items={websiteItems} />

        <MarketingContactImporter slug={access.storeSlug} />

        <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">CRM & sales</p><h2 className="mt-1 text-2xl font-black">Customer and deal pipeline</h2><p className="mt-1 text-sm text-slate-500">The standalone CRM uses the same proven pipeline engine while remaining isolated from every store's CRM data.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{store.businessType}</span></div>
          <div className="bn-admin-app light overflow-hidden rounded-2xl border border-slate-200 p-2"><CrmWorkspace slug={access.storeSlug} initial={pipeline} /></div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
          <MarketingWorkspace
            slug={access.storeSlug}
            brand={buildMarketingBrand(store)}
            items={items}
            initialTab={initialTab}
            stats={{ active: activeSubscribers, unsubscribed: unsubscribedCount, sentCampaigns: campaigns.filter(c => c.status === "SENT" || c.status === "PARTIAL").length, delivered: campaigns.reduce((n,c)=>n+c.sentCount,0), automations }}
            subscribers={subscribers.map(s => ({ id:s.id, email:s.email, createdAt:s.createdAt.toISOString(), unsubscribedAt:s.unsubscribedAt?.toISOString() ?? null }))}
            campaigns={campaigns.map(c => ({ ...c, createdAt:c.createdAt.toISOString(), content:c.content as unknown }))}
          />
        </section>
      </div>
    </main>
  );
}
