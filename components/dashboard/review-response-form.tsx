"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { respondToReview, deleteReviewResponse } from "@/lib/actions/reviews";

export function ReviewResponseForm({
  storeSlug,
  reviewId,
  existing,
}: {
  storeSlug: string;
  reviewId: string;
  existing?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing ?? "");

  function submit() {
    startTransition(async () => {
      const result = await respondToReview(storeSlug, reviewId, text);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Response saved");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete your public response to this review?")) return;
    startTransition(async () => {
      const result = await deleteReviewResponse(storeSlug, reviewId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Response deleted");
      setText("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="mt-3 flex gap-3">
        <button type="button" className="text-xs font-medium text-primary" onClick={() => setOpen(true)}>
          {existing ? "Edit response" : "Respond"}
        </button>
        {existing && (
          <button type="button" className="text-xs font-medium text-destructive disabled:opacity-50" onClick={remove} disabled={pending}>
            Delete response
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a public response"
      />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Saving…" : "Save response"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  );
}
