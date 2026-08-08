"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { issueRefund } from "@/lib/actions/refund";
import { toast } from "sonner";

export function RefundControl({ storeSlug, orderId }: { storeSlug: string; orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await issueRefund(storeSlug, orderId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Refund issued.");
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        Issue refund
      </button>
    );
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        This calls the payment provider's refund API for the full amount and marks the order REFUNDED.
        This can't be undone from here.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for the refund (kept on the payment record)"
        className="mb-2 w-full rounded-md border p-2 text-sm"
        rows={2}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !reason.trim()}
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
        >
          {isSubmitting ? "Processing…" : "Confirm refund"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={isSubmitting}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
