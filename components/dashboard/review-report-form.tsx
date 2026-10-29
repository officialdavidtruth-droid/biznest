"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportReview } from "@/lib/actions/review-reports";
import { REVIEW_REPORT_MAX_DETAILS, REVIEW_REPORT_REASONS } from "@/lib/constants/review-report";

export function ReviewReportForm({ storeSlug, reviewId }: { storeSlug: string; reviewId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await reportReview(storeSlug, reviewId, reason, details);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Report sent to BizNest");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}>
        Report this review
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        Report reviews that break the rules. A low rating on its own isn&apos;t a reason for removal — reply to it instead. BizNest staff will
        review this; the review stays visible until they decide.
      </p>
      <select
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Reason for reporting"
      >
        <option value="">Choose a reason…</option>
        {REVIEW_REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        rows={3}
        maxLength={REVIEW_REPORT_MAX_DETAILS}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything that helps us decide (optional)"
        aria-label="Details"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !reason}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-xs">Cancel</button>
      </div>
    </div>
  );
}
