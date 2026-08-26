"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replyToStoreConversation } from "@/lib/actions/store-messages";
import { toast } from "sonner";
import { Send } from "lucide-react";

type ThreadMessage = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null };
};

export function AdminMessageThread({
  slug,
  conversationId,
  currentUserId,
  messages,
}: {
  slug: string;
  conversationId: string;
  currentUserId: string;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setIsSubmitting(true);
    const result = await replyToStoreConversation(slug, conversationId, content);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setContent("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="max-h-[60vh] min-h-[200px] space-y-2.5 overflow-y-auto rounded-md bg-muted/30 p-3">
        {messages.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.map((m) => {
          // "Me" means whichever staff/owner account is currently logged
          // in — a reply from any team member renders as "You" on the
          // admin side, keeping the thread readable regardless of who on
          // the team answered.
          const isMe = m.sender.id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <p className={`mb-0.5 px-1 text-[11px] text-muted-foreground ${isMe ? "text-right" : ""}`}>
                  {isMe ? "You" : m.sender.name ?? "Customer"}
                </p>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    isMe ? "bg-primary text-primary-foreground" : "border bg-background text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Write a reply…"
          rows={2}
          className="min-h-[42px] flex-1 rounded-md border bg-background p-2.5 text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
