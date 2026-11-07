"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteStoreCompletely } from "@/lib/actions/admin";

/**
 * Super-admin only: permanently deletes a store and everything in it. Asks for the store address in a panel on the
 * page (browsers and in-app webviews often block window.prompt, which made the old button do nothing).
 */
export function DeleteStoreButton({ storeId, slug, name }: { storeId: string; slug: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteStoreCompletely(storeId, typed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`${name} was deleted`);
      setOpen(false);
      setTyped("");
      router.refresh();
    } catch {
      setError("The request failed or timed out. Reload the page to see whether the store was deleted, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-3 text-xs font-medium text-destructive hover:underline">
        Delete
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`del-${storeId}`}
          onClick={close}
        >
          <div className="w-full max-w-md rounded-lg border bg-background p-5 text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 id={`del-${storeId}`} className="text-base font-semibold">
              Delete {name}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This erases the store with its products, orders, payments, payouts, invoices and messages. The owner&apos;s
              login stays. This cannot be undone.
            </p>
            <label className="mt-4 block text-sm">
              Type the store address <b>{slug}</b> to confirm
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                autoComplete="off"
              />
            </label>
            {error && <p className="mt-3 break-words rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={close} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy || typed.trim().toLowerCase() !== slug.toLowerCase()}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
