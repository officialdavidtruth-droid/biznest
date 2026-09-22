// Route: /marketing
// The Marketing tool (contact import + dedupe) is gated: signed-out visitors
// must sign up, existing users must sign in, and only stores on the
// Business Mogul plan get to actually use it -- no payment redirect for them.
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMarketingToolAccess } from "@/lib/access/marketing-tool";
import { MarketingToolClient } from "@/components/marketing/marketing-tool-client";
import { MarketingToolLocked } from "@/components/marketing/marketing-tool-locked";
import { MarketingTemplatesSection } from "@/components/marketing/marketing-templates-section";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { buildMarketingBrand, loadMarketingItems } from "@/lib/email/marketing-brand";
import { CrmWorkspace } from "@/components/dashboard/crm-workspace";
import type { Lead } from "@/components/dashboard/crm-types";
import { getCrmDashboard } from "@/lib/actions/seo-crm";
import { getPluginEntitlement } from "@/lib/plugins";

async function loadTemplateData(slug: string) {
  const perm = await assertStorePermission(slug, "marketing");
  if (!perm.success) return null;
  return { slug, brand: buildMarketingBrand(perm.store), items: await loadMarketingItems(perm.store.id, slug) };
}

// The CRM pipeline (leads, deals, customer 360) ships in the same "CRM &
// Sales" app as email marketing -- see app/store/[slug]/admin/apps/crm/*.
// Mirrors that page's own entitlement check (plugin install, not the plan
// gate above) so a Mogul store that hasn't installed CRM doesn't see a
// pipeline it can't actually use in the dashboard.
async function loadPipelineData(slug: string) {
  const perm = await assertStorePermission(slug, "customers");
  if (!perm.success) return null;
  const entitlement = await getPluginEntitlement(perm.store.id, "crm");
  if (!entitlement.allowed || !entitlement.installed) return null;
  const result = await getCrmDashboard(slug);
  if (!result.success) return null;
  const d = result.data;
  return { leads: d.leads as unknown as Lead[], customerCount: d.customerCount, wonCount: d.wonCount, wonValue: d.wonValue };
}

export default async function MarketingStandalonePage() {
  const session = await auth();
  const access = await getMarketingToolAccess(session?.user?.id);

  // Email templates are styled with the Mogul store's own brand. Staff without the
  // "marketing" permission on that store simply don't get the template studio.
  let templates: Awaited<ReturnType<typeof loadTemplateData>> = null;
  let pipeline: Awaited<ReturnType<typeof loadPipelineData>> = null;
  if (access.status === "mogul") {
    templates = await loadTemplateData(access.storeSlug);
    pipeline = await loadPipelineData(access.storeSlug);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-700 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-extrabold text-white">BizNest <span className="text-orange-400">Marketing</span></Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link className="text-slate-200 hover:text-white" href="/">Home</Link>
            {access.status === "mogul" ? (
              <Link href={`/store/${access.storeSlug}/admin`} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 hover:bg-orange-400">
                Go to dashboard
              </Link>
            ) : access.status === "signed-out" ? (
              <Link href={`/register?callbackUrl=${encodeURIComponent("/marketing")}`} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 hover:bg-orange-400">
                Sign up
              </Link>
            ) : (
              <Link href={access.storeSlug ? `/store/${access.storeSlug}/admin/subscription` : "/templates"} className="rounded-full bg-orange-500 px-5 py-2.5 font-bold text-slate-950 hover:bg-orange-400">
                Upgrade
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-orange-400">BizNest CRM &amp; Sales &middot; Business Mogul workspace</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white sm:text-6xl">Win the deal.<br /><span className="text-orange-400">Then keep them coming back.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">A full lead pipeline, customer profiles and email marketing in one workspace &mdash; included free with the Business Mogul plan.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {access.status === "mogul" ? (
                <>
                  <a href="#pipeline" className="rounded-full bg-orange-500 px-7 py-3.5 font-bold text-slate-950 hover:bg-orange-400">Open pipeline</a>
                  <a href="#contacts" className="rounded-full border border-slate-500 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Import contacts</a>
                  {templates && <a href="#templates" className="rounded-full border border-slate-500 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Browse email templates</a>}
                </>
              ) : access.status === "signed-out" ? (
                <>
                  <Link href={`/register?callbackUrl=${encodeURIComponent("/marketing")}`} className="rounded-full bg-orange-500 px-7 py-3.5 font-bold text-slate-950 hover:bg-orange-400">Sign up</Link>
                  <Link href={`/login?callbackUrl=${encodeURIComponent("/marketing")}`} className="rounded-full border border-slate-500 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Sign in</Link>
                </>
              ) : (
                <Link href={access.storeSlug ? `/store/${access.storeSlug}/admin/subscription` : "/templates"} className="rounded-full bg-orange-500 px-7 py-3.5 font-bold text-slate-950 hover:bg-orange-400">
                  {access.storeSlug ? "Upgrade to Business Mogul" : "Choose a plan"}
                </Link>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-300">Bundled with Business Mogul &middot; Pricing configured by BizNest Superadmin</p>
          </div>
          <div className="rounded-3xl border border-blue-800 bg-slate-900/80 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><span className="font-bold text-white">CRM &amp; Sales workspace</span><span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">{access.status === "mogul" ? "Active" : "Preview"}</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Pipeline</p><p className="mt-2 text-2xl font-bold text-white">Leads &amp; deals</p><p className="mt-1 text-sm text-slate-400">New &rarr; Contacted &rarr; Qualified &rarr; Proposal &rarr; Won/Lost</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Relationships</p><p className="mt-2 text-2xl font-bold text-white">Customer 360</p><p className="mt-1 text-sm text-slate-400">One profile per customer, calls and notes included</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Audience</p><p className="mt-2 text-2xl font-bold text-white">Contacts</p><p className="mt-1 text-sm text-slate-400">Import or paste email lists</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><p className="text-sm text-slate-300">Campaigns</p><p className="mt-2 text-2xl font-bold text-white">Plan &amp; send</p><p className="mt-1 text-sm text-slate-400">Manage outreach in one place</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:col-span-2"><p className="text-sm text-slate-300">Automations</p><p className="mt-2 text-xl font-bold text-white">Follow up automatically</p><p className="mt-1 text-sm text-slate-400">Trigger emails off lead and customer activity &mdash; no manual chasing.</p></div>
            </div>
          </div>
        </div>
      </section>

      {access.status === "mogul" && pipeline && (
        <section id="pipeline" className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-widest text-orange-400">CRM &amp; Sales</p>
            <h2 className="mt-2 text-3xl font-extrabold text-white">Sales pipeline</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
              Track every lead from first contact to closed deal &mdash; the same pipeline as the CRM &amp; Sales app in your dashboard.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-white p-4">
            <CrmWorkspace slug={access.storeSlug} initial={pipeline} />
          </div>
        </section>
      )}

      {access.status === "mogul" ? <MarketingToolClient /> : <MarketingToolLocked access={access} />}
      {templates && <MarketingTemplatesSection slug={templates.slug} brand={templates.brand} items={templates.items} />}
    </main>
  );
}