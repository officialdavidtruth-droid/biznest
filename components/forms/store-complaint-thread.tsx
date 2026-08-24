"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startStoreConversation, sendStoreMessage } from "@/lib/actions/account";
import { toast } from "sonner";
import { Send } from "lucide-react";

type ThreadMessage = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null };
};

export function StoreComplaintThread({
  storeSlug,
  storeName,
  currentUserId,
  conversationId,
  messages,
}: {
  storeSlug: string;
  storeName: string;
  currentUserId: string;
  conversationId: string | null;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setIsSubmitting(true);
    const result = conversationId
      ? await sendStoreMessage(storeSlug, conversationId, content)
      : await startStoreConversation(storeSlug, content);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setContent("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-slate-900">Report a problem or complaint</p>
      <p className="mt-1 text-sm text-slate-500">
        Message {storeName} directly — for anything that isn&apos;t tied to a specific order (a missing order,
        a billing question, or a general issue), this is the place.
      </p>

      {messages.length > 0 && (
        <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {messages.map((m) => {
            const isMe = m.sender.id === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isMe ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Describe the issue…"
          className="min-h-[42px] flex-1 rounded-xl border border-slate-200 p-2.5 text-sm"
          rows={messages.length > 0 ? 1 : 3}
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
                               }
