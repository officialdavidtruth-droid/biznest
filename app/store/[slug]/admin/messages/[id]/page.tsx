import Link from "next/link";
import { listStoreConversations } from "@/lib/actions/store-messages";

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const conversations = await listStoreConversations(slug);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Messages</h1>
      <div className="divide-y rounded-lg border bg-background">
        {conversations.map((c) => {
          const customer = c.customer;
          return (
            <Link
              key={c.id}
              href={`/store/${slug}/admin/messages/${c.id}`}
              className="flex items-center justify-between p-4 transition hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-medium">{customer?.name ?? customer?.email ?? "Customer"}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {c.messages[0]?.content ?? "No messages yet"}
                </p>
              </div>
              {c.order && <span className="shrink-0 font-mono text-xs text-muted-foreground">#{c.order.id.slice(-8).toUpperCase()}</span>}
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            No conversations yet. Buyer messages will show up here.
          </div>
        )}
      </div>
    </div>
  );
}
