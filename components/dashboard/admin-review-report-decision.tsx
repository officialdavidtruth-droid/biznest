"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveReviewReport } from "@/lib/actions/review-reports";

export function AdminReviewReportDecision({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  function decide(decision: "UPHELD" | "DISMISSED") {
    if (decision === "UPHELD" && !window.confirm("Remove this review from the store? This can't be undone.")) return;
    startTransition(async () => {
      const result = await resolveReviewReport(reportId, decision, notes);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "UPHELD" ? "Review removed." : "Report dismissed.");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        rows={2}
        maxLength={1000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note explaining your decision (sent to the merchant)"
        aria-label="Decision note"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide("UPHELD")}
          disabled={pending || !notes.trim()}
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
        >
          Remove review
        </button>
        <button
          type="button"
          onClick={() => decide("DISMISSED")}
          disabled={pending || !notes.trim()}
          className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Keep review
        </button>
      </div>
    </div>
  );
}
