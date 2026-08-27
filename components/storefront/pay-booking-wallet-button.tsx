"use client";

import { useTransition } from "react";
import { payBookingWithWallet } from "@/lib/actions/customer-wallet";
import { toast } from "sonner";

export function PayBookingWithWalletButton({ slug, bookingId }: { slug: string; bookingId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await payBookingWithWallet(slug, bookingId);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("Booking paid from your wallet.");
        window.location.reload();
      })}
      className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
    >{pending ? "Processing…" : "Pay from wallet"}</button>
  );
}
