"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimDisputeForReview, resolveDispute } from "@/lib/actions/admin";
import { DISPUTE_DECISION_OPTIONS } from "@/lib/constants/dispute";
import { toast } from "sonner";
import type { DisputeStatus } from "@prisma/client";

export function AdminDisputeDecision({ disputeId, status }: { disputeId: string; status: DisputeStatus }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<DisputeStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "RESOLVED_BUYER" || status === "RESOLVED_SELLER" || status === "CLOSED") {
    return (
      <div className="rounded-2xl p-4 text-sm" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
        This dispute has already been resolved.
      </div>
    );
  }

  async function handleClaim() {
    setIsSubmitting(true);
    const result = await claimDisputeForReview(disputeId);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleResolve() {
    if (!decision) return;
    setIsSubmitting(true);
    const result = await resolveDispute(disputeId, decision, notes);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Decision recorded.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {status === "OPEN" && (
        <button
          onClick={handleClaim}
          disabled={isSubmitting}
          className="rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
        >
          Claim for review
        </button>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold" style={{ color: "hsl(var(--foreground))" }}>Decision</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DISPUTE_DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDecision(opt.value)}
              className="rounded-xl border p-3 text-left text-xs transition-colors"
              style={{
                borderColor: decision === opt.value ? "hsl(var(--primary))" : "hsl(var(--border))",
                background: decision === opt.value ? "hsl(var(--primary) / 0.08)" : "transparent",
                color: "hsl(var(--foreground))",
              }}
            >
              <p className="font-semibold">{opt.label}</p>
              <p className="mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Explain the decision — this note is shown to both the buyer and the seller."
        className="w-full rounded-xl border p-3 text-sm"
        style={{ borderColor: "hsl(var(--border))" }}
        rows={3}
      />

      <button
        onClick={handleResolve}
        disabled={isSubmitting || !decision || !notes.trim()}
        className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: "hsl(var(--primary))" }}
      >
        {isSubmitting ? "Recording…" : "Record decision"}
      </button>
    </div>
  );
}
