// Route: /store/[slug]/admin/messages
import Link from "next/link";
import { Suspense } from "react";
import { Bot, UserRound, Settings2, MessageSquareText } from "lucide-react";
import { listStoreConversations, type InboxFilter } from "@/lib/actions/store-messages";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { InboxSearch } from "@/components/dashboard/inbox-search";

// Relative time avoids server-vs-viewer timezone confusion in a server component.
function timeAgo(date: Date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const AVATAR_TONES = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-teal-100 text-teal-800"];
function tone(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Cuts the text around the first match so the searched word is visible in the list.
function around(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || text.length <= 90) return text;
  const start = Math.max(0, i - 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 110)}${start + 110 < text.length ? "…" : ""}`;
}
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-yellow-200/80 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string; filter?: string; topic?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const filter: InboxFilter = sp.filter === "unread" || sp.filter === "human" ? sp.filter : "all";
  const q = (sp.q ?? "").trim();
  const topic = sp.topic?.trim() || undefined;
  const { conversations, total, page, totalPages, denied, counts } = await listStoreConversations(slug, Number(sp.page) || 1, { q, filter, topic });

  if (denied) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold">Messages</h1>
        <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
          You don&apos;t have access to customer messages. Ask the store owner to grant the &quot;Customer messages&quot; permission.
        </div>
      </div>
    );
  }

  const base = `/store/${slug}/admin/messages`;
  const href = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: q || undefined, filter: filter === "all" ? undefined : filter, topic, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return next.size ? `${base}?${next}` : base;
  };

  const tabs: { id: InboxFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "unread", label: "Unread", count: counts.unread },
    { id: "human", label: "Needs a human", count: counts.human },
  ];
  const searching = !!(q || topic || filter !== "all");

  return (
    <div className="mx-auto max-w-4xl">
      <AutoRefresh />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chat with your customers. Common questions are answered automatically.</p>
        </div>
        <Link href={`${base}/faq`} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium shadow-sm transition hover:bg-muted/50">
          <Settings2 className="h-4 w-4" />
          Auto-replies &amp; FAQs
        </Link>
      </div>

      {counts.human > 0 && filter !== "human" && (
        <Link href={href({ filter: "human", page: undefined })} className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-100">
          <UserRound className="h-5 w-5 shrink-0" />
          <span>
            <strong>{counts.human}</strong> {counts.human === 1 ? "customer is" : "customers are"} waiting for a human agent. Tap to see {counts.human === 1 ? "them" : "who"}.
          </span>
        </Link>
      )}

      <Suspense fallback={<div className="h-11 rounded-xl border bg-background" />}>
        <InboxSearch initial={q} />
      </Suspense>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter conversations">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={href({ filter: t.id === "all" ? undefined : t.id, page: undefined })}
            role="tab"
            aria-selected={filter === t.id}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
              filter === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted/60"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] font-semibold ${filter === t.id ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
          </Link>
        ))}
      </div>

      {counts.topics.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Filed under</span>
          <Link href={href({ topic: undefined, page: undefined })} className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition ${!topic ? "bg-foreground text-background" : "bg-muted/60 hover:bg-muted"}`}>
            Everything
          </Link>
          {counts.topics.map((t) => (
            <Link key={t.topic} href={href({ topic: t.topic, page: undefined })} className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition ${topic === t.topic ? "bg-foreground text-background" : "bg-muted/60 hover:bg-muted"}`}>
              {t.topic} · {t.count}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 divide-y overflow-hidden rounded-xl border bg-background shadow-sm">
        {conversations.map((c) => {
          const customer = c.customer;
          const name = customer?.name ?? customer?.email ?? "Customer";
          const last = c.messages[0];
          const unread = c.unreadCount > 0;
          const preview = q && c.matchSnippet ? around(c.matchSnippet, q) : last ? `${c.lastMessageFromStore ? "You: " : ""}${last.content}` : "No messages yet";
          return (
            <Link
              key={c.id}
              href={`/store/${slug}/admin/messages/${c.id}`}
              className={`flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none ${c.needsHuman ? "bg-amber-50/60" : ""}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tone(name)}`}>{initials(name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>
                    <Highlight text={name} q={q} />
                  </p>
                  {last && <span className={`shrink-0 text-xs ${unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>{timeAgo(last.createdAt)}</span>}
                </div>
                <p className={`mt-0.5 line-clamp-1 text-sm ${unread ? "text-foreground" : "text-muted-foreground"}`}>
                  <Highlight text={preview} q={q} />
                </p>
                {(c.needsHuman || c.topic || c.order) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {c.needsHuman && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        <UserRound className="h-3 w-3" /> Wants a human
                      </span>
                    )}
                    {c.topic && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Bot className="h-3 w-3" /> {c.topic}
                      </span>
                    )}
                    {c.order && <span className="font-mono text-[11px] text-muted-foreground">Order #{c.order.id.slice(-8).toUpperCase()}</span>}
                  </div>
                )}
              </div>
              {unread && (
                <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}`}>
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              )}
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
            <MessageSquareText className="h-9 w-9 opacity-40" />
            {searching ? (
              <>
                <p className="font-medium text-foreground">No conversations match{q ? ` “${q}”` : ""}</p>
                <Link href={base} className="text-sm text-primary underline-offset-4 hover:underline">Clear search and filters</Link>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">No conversations yet</p>
                <p className="text-sm">When customers message you, they show up here.</p>
              </>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {totalPages} · {total} conversations</span>
          {page < totalPages ? <Link href={href({ page: String(page + 1) })} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
