"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendInvoice, markInvoicePaid } from "@/lib/actions/invoice";
import type { InvoiceStatus } from "@prisma/client";

export function InvoiceRowActions({
  storeSlug,
  invoiceId,
  status,
}: {
  storeSlug: string;
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSend(via: "email" | "whatsapp") {
    setIsSubmitting(true);
    const result = await sendInvoice(storeSlug, invoiceId, via);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.whatsappUrl) window.open(result.data.whatsappUrl, "_blank");
    toast.success("Invoice sent.");
    router.refresh();
  }

  async function handleMarkPaid() {
    setIsSubmitting(true);
    const result = await markInvoicePaid(storeSlug, invoiceId);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked as paid.");
    router.refresh();
  }

  function copyLink() {
    const url = `${window.location.origin}/invoices/${invoiceId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  }

  return (
    <div className="flex justify-end gap-3 text-xs font-medium">
      {status === "DRAFT" && (
        <button disabled={isSubmitting} onClick={() => handleSend("email")} className="text-primary hover:underline disabled:opacity-50">
          Send
        </button>
      )}
      {status !== "DRAFT" && (
        <button disabled={isSubmitting} onClick={copyLink} className="text-primary hover:underline">
          Copy link
        </button>
      )}
      {(status === "SENT") && (
        <button disabled={isSubmitting} onClick={handleMarkPaid} className="text-primary hover:underline disabled:opacity-50">
          Mark paid
        </button>
      )}
    </div>
  );
}
