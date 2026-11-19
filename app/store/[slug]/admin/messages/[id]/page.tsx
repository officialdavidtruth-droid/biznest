// Route: /store/[slug]/admin/messages/[id]
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getStoreConversation } from "@/lib/actions/store-messages";
import { AdminMessageThread } from "@/components/dashboard/admin-message-thread";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { ChevronLeft, UserRound, Bot } from "lucide-react";
import { ResolveHumanButton } from "@/components/dashboard/resolve-human-button";

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
      <AutoRefresh />
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
          {conversation.topic && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Bot className="h-3 w-3" /> {conversation.topic}
            </span>
          )}
        </div>
      </div>

      {conversation.needsHuman && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <UserRound className="h-5 w-5 shrink-0" />
            This customer asked to talk to a human. Reply below, or mark it handled.
          </span>
          <ResolveHumanButton slug={slug} conversationId={conversation.id} />
        </div>
      )}

      <AdminMessageThread
        slug={slug}
        conversationId={conversation.id}
        currentUserId={session.user.id}
        messages={conversation.messages}
      />
    </div>
  );
}
