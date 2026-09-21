"use client";

import { useMemo, useState } from "react";
import { Download, Search, Users } from "lucide-react";

export type SubscriberRow = { id: string; email: string; createdAt: string; unsubscribedAt: string | null };

export function MarketingAudience({ subscribers, total, activeCount, unsubscribedCount, slug }: { subscribers: SubscriberRow[]; total: number; activeCount: number; unsubscribedCount: number; slug: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "unsub">("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return subscribers.filter((s) => (filter === "all" || (filter === "active" ? !s.unsubscribedAt : !!s.unsubscribedAt)) && (!needle || s.email.toLowerCase().includes(needle)));
  }, [subscribers, q, filter]);

  function exportCsv() {
    const csv = ["email,joined,status", ...rows.map((s) => `"${s.email.replace(/"/g, '""')}",${s.createdAt.slice(0, 10)},${s.unsubscribedAt ? "unsubscribed" : "active"}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-subscribers.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-primary bg-[hsl(var(--primary)/0.1)] font-semibold text-primary" : "hover:border-primary/50"}`;

  return (
    <section className="rounded-2xl border bg-background">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-semibold">Subscribers</h2><p className="mt-1 text-xs text-muted-foreground">People who opted into this store&apos;s newsletter. Collected from the newsletter section on your website.</p></div>
        <button type="button" onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-primary disabled:opacity-40"><Download className="h-3.5 w-3.5" />Export CSV</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emails…" aria-label="Search subscribers" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <button type="button" onClick={() => setFilter("all")} className={chip(filter === "all")}>All {total.toLocaleString()}</button>
        <button type="button" onClick={() => setFilter("active")} className={chip(filter === "active")}>Active {activeCount.toLocaleString()}</button>
        <button type="button" onClick={() => setFilter("unsub")} className={chip(filter === "unsub")}>Unsubscribed {unsubscribedCount.toLocaleString()}</button>
      </div>
      {rows.length ? (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-2.5 font-medium">Email</th><th className="px-5 py-2.5 font-medium">Joined</th><th className="px-5 py-2.5 font-medium">Status</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-5 py-2.5 font-medium">{s.email}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-2.5">{s.unsubscribedAt ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Unsubscribed</span> : <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-primary"><Users className="h-6 w-6" /></span>
          <p className="mt-4 text-sm font-semibold">{subscribers.length ? "No subscribers match" : "No subscribers yet"}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{subscribers.length ? "Try a different search or filter." : "Add the newsletter section to your website to start collecting sign-ups, or paste emails directly when you send a campaign."}</p>
        </div>
      )}
      {total > subscribers.length && <p className="border-t px-5 py-3 text-[11px] text-muted-foreground">Showing the latest {subscribers.length.toLocaleString()} of {total.toLocaleString()} subscribers.</p>}
    </section>
  );
}
