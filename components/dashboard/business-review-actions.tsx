"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveBusiness, rejectBusiness, suspendBusiness, reinstateBusiness } from "@/lib/actions/admin";
import { toast } from "sonner";
import type { VerificationStatus } from "@prisma/client";

export function BusinessReviewActions({
  businessId,
  status,
}: {
  businessId: string;
  status: VerificationStatus;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setIsSubmitting(true);
    const result = await action();
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Done");
    router.refresh();
  }

  if (status === "PENDING") {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Rejection reason (required if rejecting)
          </label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ID document is blurry, please resubmit"
          />
        </div>
        <div className="flex gap-2">
          <button
            disabled={isSubmitting}
            onClick={() => run(() => approveBusiness(businessId))}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => run(() => rejectBusiness(businessId, reason))}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Suspension reason</label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. reports of fraudulent listings"
          />
        </div>
        <button
          disabled={isSubmitting}
          onClick={() => run(() => suspendBusiness(businessId, reason))}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Suspend business + store
        </button>
      </div>
    );
  }

  if (status === "SUSPENDED" || status === "REJECTED") {
    return (
      <button
        disabled={isSubmitting}
        onClick={() => run(() => reinstateBusiness(businessId))}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Reinstate as approved
      </button>
    );
  }

  return null;
}
