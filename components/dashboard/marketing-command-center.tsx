"use client";

import { useMemo } from "react";
import { ArrowRight, Bot, CalendarDays, ChartNoAxesCombined, FileText, Megaphone, MessageSquareText, Palette, Search, Send, Sparkles, Target, Users, Workflow } from "lucide-react";
import Link from "next/link";

type Props = { slug: string; businessName: string; leads: number; customers: number; subscribers: number; campaigns: number; automations: number; revenue: number; websiteConnected: boolean; };

export function MarketingCommandCenter(p: Props) {
  const opportunities = useMemo(() => [
    p.subscribers > 0 ? { icon: Users, title: `${p.subscribers.toLocaleString()} reachable contacts`, body: "Build a segment and launch a targeted campaign instead of sending to everyone.", href: "?tab=audience" } : { icon: Users, title: "Build your first audience", body: "Import opted-in contacts or capture subscribers from your website.", href: "#contacts" },
    p.campaigns > 0 ? { icon: ChartNoAxesCombined, title: "Measure campaign performance", body: "Review sent and failed delivery, then use the winners to plan your next campaign.", href: "?tab=campaigns" } : { icon: Megaphone, title: "Launch your first campaign", body: "Create a branded email campaign with your business identity and call to action.", href: "?tab=compose" },
    p.automations > 0 ? { icon: Workflow, title: `${p.automations} active automation${p.automations === 1 ? "" : "s"}`, body: "Keep follow-ups running automatically while you work on the business.", href: "?tab=automations" } : { icon: Workflow, title: "Automate follow-up", body: "Create welcome, nurture, win-back and lead follow-up journeys.", href: "?tab=automations" },
  ], [p]);

  const tools = [
    [Sparkles, "AI Marketing", "Campaign ideas, copy and growth actions", "AI"],
    [Target, "Audiences", "Segments, customers and lead targeting", "?tab=audience"],
    [Megaphone, "Campaigns", "Email campaigns and performance", "?tab=campaigns"],
    [Palette, "Design Studio", "Create and edit branded email campaigns", "?tab=compose"],
    [Workflow, "Journeys", "Automations and follow-up", "?tab=automations"],
    [FileText, "Landing Pages", "Campaign pages and lead capture", "#growth-tools"],
    [Search, "Lead Finder", "Build prospect lists and enrich leads", "#growth-tools"],
    [MessageSquareText, "SMS & WhatsApp", "Reach customers beyond email", "#growth-tools"],
    [CalendarDays, "Content Calendar", "Plan campaigns and social content", "#growth-tools"],
    [ChartNoAxesCombined, "Analytics", "Conversions, revenue and ROI", "#growth-tools"],
  ] as const;

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Marketing command center</p><h2 className="mt-2 text-3xl font-black tracking-tight">Turn contacts into customers.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">One workspace for acquisition, campaigns, content, automation and measurable growth. BizNest should tell you what to do next — not just give you tools.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="?tab=compose" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white"><Send className="h-4 w-4" />Create campaign</Link><Link href="#growth-tools" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"><Sparkles className="h-4 w-4" />Explore growth tools</Link></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[["Leads", p.leads], ["Customers", p.customers], ["Contacts", p.subscribers], ["Campaigns", p.campaigns], ["Automations", p.automations], ["Won value", `₦${p.revenue.toLocaleString()}`]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>)}
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      {opportunities.map(({ icon: Icon, title, body, href }) => <Link href={href} key={title} className="group rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-4"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Icon className="h-5 w-5" /></span><div className="min-w-0"><h3 className="font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{body}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Take action <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span></div></div></Link>)}
    </section>

    <section id="growth-tools" className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-lime-300">Growth toolkit</p><h2 className="mt-1 text-2xl font-black">Everything your marketing workflow needs</h2></div><p className="text-xs text-slate-400">Some channels require their provider connection before sending or publishing.</p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tools.map(([Icon, title, body, href]) => <Link key={title} href={href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"><Icon className="h-5 w-5 text-lime-300" /><p className="mt-4 font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{body}</p></Link>)}
      </div>
    </section>

    <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm"><Bot className="h-5 w-5" /></span><div><h3 className="font-black text-emerald-950">BizNest Marketing Intelligence</h3><p className="text-xs text-emerald-800/70">Connect business behavior to recommendations, campaigns and revenue attribution.</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-emerald-900"><span className="rounded-xl bg-white/80 px-3 py-2">Smart segments</span><span className="rounded-xl bg-white/80 px-3 py-2">Revenue attribution</span><span className="rounded-xl bg-white/80 px-3 py-2">A/B testing</span><span className="rounded-xl bg-white/80 px-3 py-2">AI journeys</span></div></div>
  </div>;
}
