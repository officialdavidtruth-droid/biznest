"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmManualTransferPayment, type PendingTransfer } from "@/lib/actions/manual-payment";
import { formatMoney } from "@/lib/utils/format-money";

export function PendingTransfersList({ slug, transfers }: { slug: string; transfers: PendingTransfer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function confirm(reference: string) {
    if (!window.confirm("Only confirm once the money is in your account. This marks the payment as received. Continue?")) return;
    setBusy(reference);
    const result = await confirmManualTransferPayment(slug, reference);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Payment confirmed.");
    router.refresh();
  }

  if (transfers.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Transfers waiting for you</h2>
      <p className="mb-3 max-w-xl text-sm text-muted-foreground">
        Invoices, quote deposits, bookings and reservation deposits paid by bank transfer. Confirm each one once it reaches your account.
        (Order payments are confirmed from the order itself.)
      </p>
      <ul className="divide-y rounded-lg border bg-background">
        {transfers.map((t) => (
          <li key={t.reference} className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-[10rem] flex-1">
              <p className="text-sm font-semibold">{t.purposeLabel} · {formatMoney(t.amount, t.currency)}</p>
              <p className="text-xs text-muted-foreground">
                {t.proofAt ? `Proof sent ${new Date(t.proofAt).toLocaleString()}` : "No proof uploaded yet"}
                {t.proofNote ? ` · “${t.proofNote}”` : ""}
              </p>
            </div>
            {t.proofUrl && (
              <a href={t.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">View proof</a>
            )}
            <button
              type="button"
              onClick={() => confirm(t.reference)}
              disabled={busy === t.reference}
              className="rounded-md bg-[var(--bn-admin-orange)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === t.reference ? "Confirming…" : "I've received this payment"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
