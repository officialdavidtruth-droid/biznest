"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Inbox, LifeBuoy, MessageSquare, Timer } from "lucide-react";
import { replyToStoreConversation } from "@/lib/actions/store-messages";
import type { HelpdeskMetrics, HelpdeskThread } from "@/lib/actions/helpdesk";

type Filter = "needs_reply" | "late" | "answered" | "all";

function duration(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d`;
}

function waiting(hours: number | null) {
  if (hours == null) return "";
  if (hours < 1) return "Waiting < 1h";
  if (hours < 24) return `Waiting ${hours}h`;
  return `Waiting ${Math.floor(hours / 24)}d`;
}

export function HelpdeskWorkspace({ slug, data }: { slug: string; data: { threads: HelpdeskThread[]; metrics: HelpdeskMetrics } }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<Filter>(data.metrics.needsReply > 0 ? "needs_reply" : "all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const m = data.metrics;

  const visible = useMemo(() => data.threads.filter((t) => {
    if (filter === "needs_reply" && t.status !== "needs_reply") return false;
    if (filter === "late" && (t.waitingHours ?? 0) < 24) return false;
    if (filter === "answered" && t.status !== "answered") return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${t.customerName} ${t.customerEmail ?? ""} ${t.orderRef ?? ""} ${t.lastMessage}`.toLowerCase().includes(needle);
  }), [data.threads, filter, q]);

  const send = (id: string) => {
    if (!draft.trim()) { toast.error("Write a reply first."); return; }
    start(async () => {
      const r = await replyToStoreConversation(slug, id, draft);
      if (!r.success) toast.error(r.error);
      else { toast.success("Reply sent"); setDraft(""); setOpenId(null); router.refresh(); }
    });
  };

  const cards: [string, string | number, typeof Inbox, string][] = [
    ["Needs reply", m.needsReply, Inbox, m.needsReply > 0 ? "text-amber-600" : "text-emerald-600"],
    ["Waiting over 24h", m.waitingOver24h, Clock3, m.waitingOver24h > 0 ? "text-red-600" : "text-emerald-600"],
    ["Median first response (30d)", duration(m.medianFirstResponseMinutes), Timer, "text-primary"],
    ["Answered", m.answered, CheckCircle2, "text-emerald-600"],
  ];
  const chips: [Filter, string, number][] = [["needs_reply", "Needs reply", m.needsReply], ["late", "Over 24h", m.waitingOver24h], ["answered", "Answered", m.answered], ["all", "All", m.total]];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><LifeBuoy className="h-5 w-5 text-primary" /> Customer Support</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Every customer conversation in one queue, with the ones waiting longest at the top.</p>
        </div>
        <Link href={`/store/${slug}/admin/messages`} className="rounded-xl border px-4 py-2.5 text-xs font-semibold">Open full inbox</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([l, v, Icon, c]) => <div key={l} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{l}</span><Icon className={`h-4 w-4 ${c}`} /></div><p className="mt-2 text-2xl font-bold">{v}</p></div>)}
      </div>

      <section className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chips.map(([k, l, n]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === k ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>{l} ({n})</button>)}
          <input className="ml-auto w-full rounded-lg border bg-background px-3 py-1.5 text-xs sm:w-52" placeholder="Search customer, order or message" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">{data.threads.length === 0 ? "No conversations yet. When customers message your store, they'll appear here." : filter === "needs_reply" ? "You're all caught up. No customer is waiting on a reply." : "Nothing matches this filter."}</p>
        ) : (
          <ul className="divide-y">
            {visible.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.customerName}{t.orderRef && <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{t.orderRef}</span>}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.lastFromCustomer ? "" : "You: "}{t.lastMessage || "No messages yet"}</p>
                  </div>
                  {t.status === "needs_reply" && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${(t.waitingHours ?? 0) >= 24 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{waiting(t.waitingHours)}</span>}
                  {t.status === "answered" && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Answered</span>}
                </div>
                {openId === t.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea autoFocus rows={3} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder={`Reply to ${t.customerName}`} value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => send(t.id)} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">{busy ? "Sending..." : "Send reply"}</button>
                      <button type="button" onClick={() => { setOpenId(null); setDraft(""); }} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setOpenId(t.id); setDraft(""); }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"><MessageSquare className="h-3 w-3" /> Reply</button>
                    <Link href={`/store/${slug}/admin/messages/${t.id}`} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">Open thread</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
