"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPayoutPaid, retryFailedPayout } from "@/lib/actions/admin-payouts";

export function PayoutRowActions({ payoutId, canRetry }: { payoutId: string; canRetry: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => ReturnType<typeof retryFailedPayout>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canRetry && (
          <button
            disabled={pending}
            onClick={() => run(() => retryFailedPayout(payoutId))}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {pending ? "Working…" : "Retry"}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => {
            const note = window.prompt("Mark as paid manually. Enter the bank transfer reference or a note:");
            if (note === null) return;
            run(() => markPayoutPaid(payoutId, note));
          }}
          className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          Mark paid
        </button>
      </div>
      {error && <p className="max-w-[220px] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
