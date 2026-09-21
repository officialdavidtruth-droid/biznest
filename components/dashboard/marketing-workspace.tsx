"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Palette } from "lucide-react";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";
import { useEmailDesign } from "@/components/marketing/email-designer";
import { MarketingEmailComposer } from "@/components/dashboard/marketing-email-composer";
import { MarketingAudience, type SubscriberRow } from "@/components/dashboard/marketing-audience";
import { MarketingCampaigns, type CampaignRow } from "@/components/dashboard/marketing-campaigns";
import { MarketingAutomationPanel } from "@/components/dashboard/marketing-automation-panel";

export type MarketingTab = "compose" | "audience" | "campaigns" | "automations";
const TABS: Array<{ id: MarketingTab; label: string }> = [
  { id: "compose", label: "New campaign" },
  { id: "audience", label: "Audience" },
  { id: "campaigns", label: "Campaigns" },
  { id: "automations", label: "Automations" },
];

export type MarketingStats = { active: number; unsubscribed: number; sentCampaigns: number; delivered: number; automations: number };

export function MarketingWorkspace({
  slug,
  brand,
  items,
  stats,
  subscribers,
  campaigns,
  initialTab,
}: {
  slug: string;
  brand: MarketingBrand;
  items: MarketingItem[];
  stats: MarketingStats;
  subscribers: SubscriberRow[];
  campaigns: CampaignRow[];
  initialTab: MarketingTab;
}) {
  const router = useRouter();
  const design = useEmailDesign(brand, items);
  const [tab, setTabState] = useState<MarketingTab>(initialTab);

  function setTab(next: MarketingTab) {
    setTabState(next);
    window.history.replaceState(null, "", `?tab=${next}`);
  }

  const count: Partial<Record<MarketingTab, number>> = { audience: stats.active, campaigns: campaigns.length, automations: stats.automations };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email marketing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Design branded emails, send them to your subscribers and see who they reached.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/store/${slug}/admin/customize`} className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary"><Palette className="h-3.5 w-3.5" />Edit brand</Link>
          <Link href={`/store/${slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary"><ExternalLink className="h-3.5 w-3.5" />View website</Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-2xl border bg-background sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Active subscribers", stats.active],
          ["Unsubscribed", stats.unsubscribed],
          ["Campaigns sent", stats.sentCampaigns],
          ["Emails delivered", stats.delivered],
        ].map(([label, value]) => (
          <div key={label as string} className="px-5 py-4"><dt className="text-[11px] font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{Number(value).toLocaleString()}</dd></div>
        ))}
      </dl>

      <div role="tablist" aria-label="Email marketing sections" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`mk-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`mk-pane-${t.id}`} onClick={() => setTab(t.id)} className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {count[t.id] !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count[t.id]}</span>}
          </button>
        ))}
      </div>

      {/* The composer stays mounted so switching tabs never loses an email in progress. */}
      <div role="tabpanel" id="mk-pane-compose" aria-labelledby="mk-tab-compose" hidden={tab !== "compose"}>
        <MarketingEmailComposer slug={slug} design={design} activeSubscribers={stats.active} onSent={() => router.refresh()} />
      </div>
      <div role="tabpanel" id="mk-pane-audience" aria-labelledby="mk-tab-audience" hidden={tab !== "audience"}>
        <MarketingAudience slug={slug} subscribers={subscribers} total={stats.active + stats.unsubscribed} activeCount={stats.active} unsubscribedCount={stats.unsubscribed} />
      </div>
      <div role="tabpanel" id="mk-pane-campaigns" aria-labelledby="mk-tab-campaigns" hidden={tab !== "campaigns"}>
        <MarketingCampaigns
          campaigns={campaigns}
          onCompose={() => setTab("compose")}
          onReuse={(c) => {
            design.loadFrom({ ...(c.content && typeof c.content === "object" ? c.content : {}), template: c.template, subject: c.subject });
            setTab("compose");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
      <div role="tabpanel" id="mk-pane-automations" aria-labelledby="mk-tab-automations" hidden={tab !== "automations"}>
        <MarketingAutomationPanel slug={slug} activeCount={stats.automations} />
      </div>
    </div>
  );
}
