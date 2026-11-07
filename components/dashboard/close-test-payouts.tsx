"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { closeTestPayouts } from "@/lib/actions/admin-payouts";

/** Stops retries and alerts for payouts that came from test payments: settles every queued, failed and reversed payout. */
export function CloseTestPayouts({ openCount }: { openCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("Test payments");
  const [error, setError] = useState<string | null>(null);

  if (openCount === 0) return null;

  function confirm() {
    setError(null);
    start(async () => {
      const res = await closeTestPayouts(note);
      if (!res.success) {
        setError(res.error);
        return;
      }
      toast.success(`Closed ${res.data.closed} test payout${res.data.closed === 1 ? "" : "s"}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {openCount} payout{openCount === 1 ? " is" : "s are"} still queued or need attention. If they came from test payments,
          close them to stop the retries and alerts.
        </p>
        {!open && (
          <button onClick={() => setOpen(true)} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            Close test payouts
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            This marks every queued, failed and reversed payout as settled and sends nothing to anyone. Held and processing payouts are not touched. Only do this if no store is owed this money.
          </p>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full max-w-sm rounded-md border bg-background px-3 py-1.5 text-sm" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button disabled={pending || !note.trim()} onClick={confirm} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "Closing…" : `Close ${openCount} payout${openCount === 1 ? "" : "s"}`}
            </button>
            <button disabled={pending} onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
