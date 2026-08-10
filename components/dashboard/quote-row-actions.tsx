"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendQuote } from "@/lib/actions/quote";
import type { QuoteStatus } from "@prisma/client";

export function QuoteRowActions({
  storeSlug,
  quoteId,
  status,
}: {
  storeSlug: string;
  quoteId: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSend() {
    setIsSubmitting(true);
    const result = await sendQuote(storeSlug, quoteId, "email");
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.whatsappUrl) window.open(result.data.whatsappUrl, "_blank");
    toast.success("Quote sent.");
    router.refresh();
  }

  function copyLink() {
    const url = `${window.location.origin}/quotes/${quoteId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  }

  return (
    <div className="flex justify-end gap-3 text-xs font-medium">
      {status === "DRAFT" && (
        <button disabled={isSubmitting} onClick={handleSend} className="text-primary hover:underline disabled:opacity-50">
          Send
        </button>
      )}
      {status !== "DRAFT" && (
        <button disabled={isSubmitting} onClick={copyLink} className="text-primary hover:underline">
          Copy link
        </button>
      )}
    </div>
  );
}
