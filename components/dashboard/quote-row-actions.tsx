"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendQuote, getQuoteShareLink, withdrawQuote } from "@/lib/actions/quote";
import type { QuoteStatus } from "@prisma/client";

export function QuoteRowActions({
  storeSlug,
  quoteId,
  status,
  incomingRequest = false,
}: {
  storeSlug: string;
  quoteId: string;
  status: QuoteStatus;
  incomingRequest?: boolean;
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

  async function handleWithdraw() {
    if (!window.confirm("Withdraw this quote? The customer will no longer be able to accept it.")) return;
    setIsSubmitting(true);
    const result = await withdrawQuote(storeSlug, quoteId);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.depositInFlight) toast.warning("Quote withdrawn. A customer was mid-payment on the deposit; review and refund it if needed.");
    else toast.success("Quote withdrawn.");
    router.refresh();
  }

  async function copyLink() {
    // The customer page needs the signed token, which only the server can mint.
    const result = await getQuoteShareLink(storeSlug, quoteId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    try {
      await navigator.clipboard.writeText(result.data.url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy automatically. Please copy the link from the address bar.");
    }
  }

  if (incomingRequest) {
    return <span className="text-xs font-medium text-muted-foreground">Review request</span>;
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
      {status === "SENT" && (
        <button disabled={isSubmitting} onClick={handleWithdraw} className="text-destructive hover:underline disabled:opacity-50">
          Withdraw
        </button>
      )}
    </div>
  );
}
