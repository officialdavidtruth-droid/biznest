"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelReferralAction, retryReferralPayoutAction } from "@/lib/actions/referral";

export function ReferralRowActions({ slug, referralId }: { slug: string; referralId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(kind: "pay" | "cancel") {
    if (kind === "cancel" && !window.confirm("Cancel this referral? No points will be paid for it.")) return;
    setPending(true);
    try {
      const res = kind === "pay" ? await retryReferralPayoutAction(slug, referralId) : await cancelReferralAction(slug, referralId);
      if (!res.success) return void toast.error(res.error);
      toast.success(kind === "pay" ? "Reward paid." : "Referral cancelled.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => run("pay")} className="rounded-md border px-2 py-1 text-xs disabled:opacity-50">Pay now</button>
      <button type="button" disabled={pending} onClick={() => run("cancel")} className="rounded-md border px-2 py-1 text-xs text-destructive disabled:opacity-50">Cancel</button>
    </div>
  );
}
