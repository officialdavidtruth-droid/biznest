"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptQuote, declineQuote } from "@/lib/actions/quote";

export function QuoteActions({ quoteId, hasDeposit }: { quoteId: string; hasDeposit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptQuote(quoteId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data.authorizationUrl) {
        window.location.href = result.data.authorizationUrl;
        return;
      }
      toast.success("Quote accepted.");
      router.refresh();
    });
  }

  function decline() {
    startTransition(async () => {
      const result = await declineQuote(quoteId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Quote declined.");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={accept}
        disabled={isPending}
        className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {isPending ? "Please wait…" : hasDeposit ? "Accept & pay deposit" : "Accept quote"}
      </button>
      <button
        onClick={decline}
        disabled={isPending}
        className="flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
