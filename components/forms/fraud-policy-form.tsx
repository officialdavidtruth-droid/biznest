"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptFraudPolicy } from "@/lib/actions/business";
import { toast } from "sonner";

export function FraudPolicyForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAccept() {
    setIsSubmitting(true);
    const result = await acceptFraudPolicy({ businessId, accepted: true });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.push("/onboarding/create-store");
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5"
        />
        I have read and agree to the seller agreement and fraud policy above.
      </label>

      <button
        onClick={handleAccept}
        disabled={!checked || isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Accept & continue"}
      </button>
    </div>
  );
}
