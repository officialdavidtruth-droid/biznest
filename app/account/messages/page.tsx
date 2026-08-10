import { listConversationsForUser } from "@/lib/actions/account";
import { auth } from "@/lib/auth";
import { MessageSquare } from "lucide-react";

export default async function MessagesPage() {
  const session = await auth();
  const conversations = await listConversationsForUser();

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No conversations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((c) => {
        const other = c.participants.find((p) => p.user.id !== session?.user?.id)?.user;
        const lastMessage = c.messages[0];
        return (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
              {other?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.image} alt={other.name ?? ""} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">{other?.name ?? "Unknown"}</div>
              <div className="truncate text-xs text-slate-500">{lastMessage?.content ?? "No messages yet"}</div>
            </div>
            {lastMessage && (
              <div className="shrink-0 text-xs text-slate-400">
                {new Date(lastMessage.createdAt).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
