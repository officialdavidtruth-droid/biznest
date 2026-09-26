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

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  SENT: { label: "Sent", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500" },
  PARTIAL: { label: "Partly sent", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500" },
  FAILED: { label: "Failed", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", dot: "bg-rose-500" },
  SENDING: { label: "Sending", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300", dot: "bg-sky-500" },
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
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
      <div className="flex items-center justify-between border-b p-5">
        <div><h2 className="text-sm font-semibold">Campaigns</h2><p className="mt-1 text-xs text-muted-foreground">Every send, with who it reached. Reuse one as the starting point for your next email.</p></div>
        <button type="button" onClick={onCompose} className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:inline-flex">New campaign</button>
      </div>
      <ul className="divide-y">
        {campaigns.map((c) => {
          const st = STATUS[c.status] ?? STATUS.DRAFT;
          const pct = c.recipientCount ? Math.round((c.sentCount / c.recipientCount) * 100) : 0;
          return (
            <li key={c.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:flex ${st.cls}`}>{c.subject.trim().slice(0, 1).toUpperCase() || "#"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{c.subject}</p>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                </div>
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
