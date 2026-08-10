"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendDisputeMessage } from "@/lib/actions/dispute";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function DisputeMessageForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setIsSubmitting(true);
    const result = await sendDisputeMessage(orderId, content);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setContent("");
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Write a message…"
        className="min-h-[42px] flex-1 rounded-xl border border-slate-200 p-2.5 text-sm"
        rows={1}
      />
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !content.trim()}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
