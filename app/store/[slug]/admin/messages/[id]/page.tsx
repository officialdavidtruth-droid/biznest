// Route: /store/[slug]/admin/messages/[id]
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getStoreConversation } from "@/lib/actions/store-messages";
import { AdminMessageThread } from "@/components/dashboard/admin-message-thread";
import { ChevronLeft } from "lucide-react";

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();
  const conversation = await getStoreConversation(slug, id);
  if (!conversation || !session?.user?.id) notFound();

  const customer = conversation.customer;

  return (
    <div>
      <Link
        href={`/store/${slug}/admin/messages`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Messages
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{customer?.name ?? customer?.email ?? "Customer"}</h1>
          {conversation.order && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              Order #{conversation.order.id.slice(-8).toUpperCase()}
            </p>
          )}
        </div>
      </div>

      <AdminMessageThread
        slug={slug}
        conversationId={conversation.id}
        currentUserId={session.user.id}
        messages={conversation.messages}
      />
    </div>
  );
}
