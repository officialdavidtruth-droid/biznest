"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Palette, PenSquare, Users, Send, Workflow, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";
import { useEmailDesign } from "@/components/marketing/email-designer";
import { MarketingEmailComposer } from "@/components/dashboard/marketing-email-composer";
import { MarketingAudience, type SubscriberRow } from "@/components/dashboard/marketing-audience";
import { MarketingCampaigns, type CampaignRow } from "@/components/dashboard/marketing-campaigns";
import { MarketingAutomationPanel } from "@/components/dashboard/marketing-automation-panel";

export type MarketingTab = "compose" | "audience" | "campaigns" | "automations";
const TABS: Array<{ id: MarketingTab; label: string; icon: typeof PenSquare; hint: string }> = [
  { id: "compose", label: "New campaign", icon: PenSquare, hint: "Design & send" },
  { id: "campaigns", label: "Campaigns", icon: Send, hint: "History & performance" },
  { id: "audience", label: "Audience", icon: Users, hint: "Subscribers & lists" },
  { id: "automations", label: "Automations", icon: Workflow, hint: "Always-on flows" },
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

  const deliveryRate = stats.sentCampaigns ? Math.round((stats.delivered / Math.max(stats.sentCampaigns * Math.max(stats.active, 1), 1)) * 100) : 0;
  const statCards: Array<{ label: string; value: number; tone: string; trend?: { dir: "up" | "down"; label: string } }> = [
    { label: "Active subscribers", value: stats.active, tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300", trend: stats.unsubscribed ? { dir: "down", label: `${stats.unsubscribed} unsubscribed` } : undefined },
    { label: "Campaigns sent", value: stats.sentCampaigns, tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
    { label: "Emails delivered", value: stats.delivered, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", trend: deliveryRate ? { dir: "up", label: `${deliveryRate}% delivery rate` } : undefined },
    { label: "Active automations", value: stats.automations, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Design branded emails, grow your audience and automate what happens next.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/store/${slug}/admin/customize`} className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary"><Palette className="h-3.5 w-3.5" />Edit brand</Link>
          <Link href={`/store/${slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium hover:border-primary"><ExternalLink className="h-3.5 w-3.5" />View website</Link>
          <button type="button" onClick={() => setTab("compose")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"><PenSquare className="h-3.5 w-3.5" />Create campaign</button>
        </div>
      </div>

      {/* Colorful KPI strip, Brevo-style */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.tone}`}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{s.label}</dt>
            <dd className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">{s.value.toLocaleString()}</dd>
            {s.trend && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-80">
                {s.trend.dir === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {s.trend.label}
              </p>
            )}
          </div>
        ))}
      </dl>

      {/* Brevo-style layout: left rail of sections, content on the right */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Marketing sections" className="flex gap-1 overflow-x-auto rounded-2xl border bg-background p-1.5 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-visible">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`mk-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`mk-pane-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:shrink ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.label}</span>
                  <span className="hidden truncate text-[11px] font-normal opacity-70 lg:block">{t.hint}</span>
                </span>
                {count[t.id] !== undefined && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{count[t.id]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
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
      </div>
    </div>
  );
}
