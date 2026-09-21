"use client";

import { Copy, Send } from "lucide-react";
import { marketingTemplateName } from "@/lib/email/marketing-templates";

export type CampaignRow = {
  id: string;
  subject: string;
  template: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  content: unknown;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Sent", cls: "bg-emerald-500/10 text-emerald-700" },
  PARTIAL: { label: "Partly sent", cls: "bg-amber-500/15 text-amber-700" },
  FAILED: { label: "Failed", cls: "bg-rose-500/10 text-rose-700" },
  SENDING: { label: "Sending", cls: "bg-sky-500/10 text-sky-700" },
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
};

export function MarketingCampaigns({ campaigns, onReuse, onCompose }: { campaigns: CampaignRow[]; onReuse: (c: CampaignRow) => void; onCompose: () => void }) {
  if (!campaigns.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-background p-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Send className="h-6 w-6" /></span>
        <h2 className="mt-4 text-sm font-semibold">No campaigns yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Every email you send is recorded here with how many people it reached.</p>
        <button type="button" onClick={onCompose} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Create your first campaign</button>
      </div>
    );
  }
  return (
    <section className="rounded-2xl border bg-background">
      <div className="border-b p-5"><h2 className="text-sm font-semibold">Campaign history</h2><p className="mt-1 text-xs text-muted-foreground">Your most recent sends. Reuse one as the starting point for your next email.</p></div>
      <ul className="divide-y">
        {campaigns.map((c) => {
          const st = STATUS[c.status] ?? STATUS.DRAFT;
          const pct = c.recipientCount ? Math.round((c.sentCount / c.recipientCount) * 100) : 0;
          return (
            <li key={c.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{c.subject}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{marketingTemplateName(c.template)} · {new Date(c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <div className="w-full sm:w-48">
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>Delivered</span><span className="font-semibold text-foreground tabular-nums">{c.sentCount.toLocaleString()} / {c.recipientCount.toLocaleString()}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${c.status === "FAILED" ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
                {c.failedCount > 0 && <p className="mt-1 text-[10px] text-rose-600">{c.failedCount} failed</p>}
              </div>
              <button type="button" onClick={() => onReuse(c)} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-primary sm:self-center"><Copy className="h-3.5 w-3.5" />Reuse</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
