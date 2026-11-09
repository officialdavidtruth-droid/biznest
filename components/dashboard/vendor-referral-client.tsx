"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { withdrawReferralRewards } from "@/lib/actions/vendor-referral";

export function CopyReferralLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
      <button onClick={copy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function WithdrawButton({ slug, amount, disabled }: { slug: string; amount: number; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm(`Withdraw ₦${amount.toLocaleString()} to your connected bank account?`)) return;
    setBusy(true);
    const r = await withdrawReferralRewards(slug);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success(r.data.status === "REVIEW" ? "Your withdrawal is waiting for approval." : r.data.status === "PAID" ? "Withdrawal sent to your bank." : "Withdrawal started. It should reach your bank shortly.");
    router.refresh();
  }
  return (
    <button onClick={go} disabled={disabled || busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
      {busy ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}
