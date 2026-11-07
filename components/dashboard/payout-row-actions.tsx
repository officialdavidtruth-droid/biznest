"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPayoutPaid, retryFailedPayout } from "@/lib/actions/admin-payouts";

export function PayoutRowActions({ payoutId, canRetry }: { payoutId: string; canRetry: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

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
          onClick={() => setNoting((v) => !v)}
          className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          Mark paid
        </button>
      </div>
      {noting && (
        <div className="flex items-center gap-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bank reference or note"
            className="w-44 rounded-md border bg-background px-2 py-1 text-xs"
          />
          <button
            disabled={pending || !note.trim()}
            onClick={() => run(() => markPayoutPaid(payoutId, note))}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
      {error && <p className="max-w-[220px] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
