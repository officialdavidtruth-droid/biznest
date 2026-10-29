// Route: /store/[slug]/admin/messages
import Link from "next/link";
import { listStoreConversations } from "@/lib/actions/store-messages";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";

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

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const { conversations, total, page, totalPages, denied } = await listStoreConversations(slug, Number(pageParam) || 1);

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

  return (
    <div>
      <AutoRefresh />
      <h1 className="mb-6 text-xl font-semibold">Messages</h1>
      <div className="divide-y rounded-lg border bg-background">
        {conversations.map((c) => {
          const customer = c.customer;
          const last = c.messages[0];
          const unread = c.unreadCount > 0;
          return (
            <Link
              key={c.id}
              href={`/store/${slug}/admin/messages/${c.id}`}
              className="flex items-center justify-between gap-3 p-4 transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>
                    {customer?.name ?? customer?.email ?? "Customer"}
                  </p>
                  {last && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(last.createdAt)}</span>}
                </div>
                <p className={`mt-0.5 truncate text-sm ${unread ? "text-foreground" : "text-muted-foreground"}`}>
                  {last ? `${c.lastMessageFromStore ? "You: " : ""}${last.content}` : "No messages yet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {unread && (
                  <span
                    className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
                    aria-label={`${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}`}
                  >
                    {c.unreadCount > 99 ? "99+" : c.unreadCount}
                  </span>
                )}
                {c.order && <span className="font-mono text-xs text-muted-foreground">#{c.order.id.slice(-8).toUpperCase()}</span>}
              </div>
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            No conversations yet. Buyer messages will show up here.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={`/store/${slug}/admin/messages?page=${page - 1}`} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total} conversations
          </span>
          {page < totalPages ? (
            <Link href={`/store/${slug}/admin/messages?page=${page + 1}`} className="rounded-md border px-3 py-1.5 hover:bg-muted/40">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
