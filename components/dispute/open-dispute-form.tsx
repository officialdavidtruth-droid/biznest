"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openDispute } from "@/lib/actions/dispute";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export function OpenDisputeForm({ orderId, viewer }: { orderId: string; viewer: "buyer" | "seller" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await openDispute(orderId, reason);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Dispute opened — BizNest support has been notified.");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        <p className="mb-3 text-sm text-slate-500">
          {viewer === "buyer"
            ? "Didn't receive your order, or received something wrong? Open a dispute and BizNest will step in."
            : "If a buyer is disputing this order outside the app, you can open the case here yourself."}
        </p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Open a dispute
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <label className="mb-1 block text-sm font-semibold text-slate-900">What went wrong?</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={
          viewer === "buyer"
            ? "e.g. I didn't receive my order — it's been over a week since it was marked delivered."
            : "e.g. The order was delivered — describe what happened."
        }
        className="mb-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
        rows={4}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !reason.trim()}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Submitting…" : "Submit dispute"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={isSubmitting}
          className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
