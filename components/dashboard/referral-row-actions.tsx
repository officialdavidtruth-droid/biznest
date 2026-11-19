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
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <button type="button" disabled={pending} onClick={() => run("pay")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Pay now</button>
      <button type="button" disabled={pending} onClick={() => run("cancel")} className="rounded-xl border px-4 py-2.5 text-xs font-semibold text-destructive disabled:opacity-50">Cancel</button>
    </div>
  );
}
