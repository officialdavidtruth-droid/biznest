import { prisma } from "@/lib/prisma";

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const conversations = await prisma.conversation.findMany({
    where: { order: { storeId: store.id } },
    include: {
      order: { include: { buyer: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Messages</h1>
      <div className="divide-y rounded-lg border bg-background">
        {conversations.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{c.order?.buyer.name ?? c.order?.buyer.email ?? "Customer"}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {c.messages[0]?.content ?? "No messages yet"}
              </p>
            </div>
            {c.order && <span className="font-mono text-xs text-muted-foreground">#{c.order.id.slice(-8).toUpperCase()}</span>}
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            No conversations yet. Buyer messages tied to an order will show up here.
          </div>
        )}
      </div>
    </div>
  );
}
