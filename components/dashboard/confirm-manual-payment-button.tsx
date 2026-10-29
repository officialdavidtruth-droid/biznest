"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmManualOrderPayment } from "@/lib/actions/manual-payment";

export function ConfirmManualPaymentButton({ storeSlug, orderId }: { storeSlug: string; orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!window.confirm("Only confirm once the money is in your account. This marks the order as paid and starts fulfilment. Continue?")) return;
    setBusy(true);
    const result = await confirmManualOrderPayment(storeSlug, orderId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment confirmed. The order is now paid.");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={confirm}
      disabled={busy}
      className="rounded-md bg-[var(--bn-admin-orange)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {busy ? "Confirming…" : "I've received this payment"}
    </button>
  );
}
