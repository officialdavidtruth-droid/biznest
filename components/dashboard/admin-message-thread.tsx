"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { replyToStoreConversation } from "@/lib/actions/store-messages";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { MAX_MESSAGE_LENGTH } from "@/lib/message-limits";

type ThreadMessage = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null };
  /** Sent by the owner or any staff member (not necessarily the viewer). */
  fromStore: boolean;
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
  // Synchronous lock: state updates are async, so two fast Enter presses can
  // both see isSubmitting === false. A ref flips immediately.
  const sendingRef = useRef(false);

  // Newest message is at the bottom, so the thread starts there. When new
  // messages arrive later (our own reply, or a customer message picked up by
  // AutoRefresh) we only follow them if the viewer is already near the bottom
  // or just sent something; otherwise they'd be yanked away from older
  // messages they're reading, so we show a "New messages" button instead.
  const listRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const nearBottomRef = useRef(true);
  const justSentRef = useRef(false);
  const [newBelow, setNewBelow] = useState(false);

  function scrollToBottom(behavior: ScrollBehavior) {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottomRef.current) setNewBelow(false);
  }

  useEffect(() => {
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      scrollToBottom("auto");
      return;
    }
    if (justSentRef.current || nearBottomRef.current) {
      justSentRef.current = false;
      scrollToBottom("smooth");
    } else {
      setNewBelow(true);
    }
  }, [messages.length]);

  async function handleSubmit() {
    // Enter-key presses reach this function even while a send is in flight
    // (only the button is disabled), so guard here to prevent duplicate replies.
    if (sendingRef.current || !content.trim()) return;
    sendingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await replyToStoreConversation(slug, conversationId, content);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setContent("");
      justSentRef.current = true;
      router.refresh();
    } catch {
      // Network drop, deploy mid-request, etc. The typed text is kept so the
      // reply can be retried.
      toast.error("Couldn't send your reply. Check your connection and try again.");
    } finally {
      // Always release the lock, otherwise a thrown error leaves the send
      // button disabled until the page is reloaded.
      sendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div ref={listRef} onScroll={handleScroll} className="max-h-[60vh] min-h-[200px] space-y-2.5 overflow-y-auto rounded-md bg-muted/30 p-3">
        {messages.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.map((m) => {
          // Alignment follows the store side: every team member's reply sits on
          // the right, the customer on the left. Only the viewer's own messages
          // are labelled "You"; colleagues keep their name (or "Staff" if they
          // have none), so a nameless team member is never shown as "Customer".
          const isMe = m.sender.id === currentUserId;
          const label = isMe ? "You" : m.fromStore ? m.sender.name ?? "Staff" : m.sender.name ?? "Customer";
          return (
            <div key={m.id} className={`flex ${m.fromStore ? "justify-end" : "justify-start"}`}>
              <div className="min-w-0 max-w-[85%]">
                <p className={`mb-0.5 px-1 text-[11px] text-muted-foreground ${m.fromStore ? "text-right" : ""}`}>
                  {label}
                </p>
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                    m.fromStore ? "bg-primary text-primary-foreground" : "border bg-background text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {newBelow && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              scrollToBottom("smooth");
              setNewBelow(false);
            }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow"
          >
            New messages ↓
          </button>
        </div>
      )}
      {content.length > MAX_MESSAGE_LENGTH * 0.9 && (
        <p className="mt-2 text-right text-[11px] text-muted-foreground">
          {content.length}/{MAX_MESSAGE_LENGTH}
        </p>
      )}
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
          maxLength={MAX_MESSAGE_LENGTH}
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
