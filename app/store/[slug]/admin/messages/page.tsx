import { prisma } from "@/lib/prisma";

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  // Conversation.storeId is set directly for the general "contact the
  // store" flow (lib/actions/account.ts: startStoreConversation) used
  // whenever a customer messages a seller without referencing a specific
  // order -- Conversation.orderId is null for those. Filtering only on
  // `order: { storeId }` (the old query) can never match a null orderId,
  // so every one of those messages -- which do still fire a real
  // Notification row, which is why they showed up there -- silently never
  // appeared here. Match on either link so both conversation types show.
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ storeId: store.id }, { order: { storeId: store.id } }] },
    include: {
      order: { include: { buyer: true } },
      participants: { include: { user: { select: { name: true, email: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Messages</h1>
      <div className="divide-y rounded-lg border bg-background">
        {conversations.map((c) => {
          // Order-tied conversations: the buyer on the order. General
          // conversations: whichever participant isn't the store owner.
          const customer = c.order?.buyer ?? c.participants.find((p) => p.userId !== c.order?.buyer.id)?.user;
          return (
            <div key={c.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{customer?.name ?? customer?.email ?? "Customer"}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {c.messages[0]?.content ?? "No messages yet"}
                </p>
              </div>
              {c.order && <span className="font-mono text-xs text-muted-foreground">#{c.order.id.slice(-8).toUpperCase()}</span>}
            </div>
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
