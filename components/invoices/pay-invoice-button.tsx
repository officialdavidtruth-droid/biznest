"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { payInvoice } from "@/lib/actions/invoice";

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      const result = await payInvoice(invoiceId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.data.authorizationUrl;
    });
  }

  return (
    <button
      onClick={pay}
      disabled={isPending}
      className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
    >
      {isPending ? "Starting payment…" : "Pay invoice"}
    </button>
  );
}
