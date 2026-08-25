"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { resendOrderConfirmationEmail } from "@/lib/actions/order";

/**
 * Safety net for the callback/webhook race described in
 * lib/actions/order.ts's resendOrderConfirmationEmail — lets a buyer who
 * never got their receipt (or can't find it) trigger a fresh send
 * themselves instead of needing to contact support.
 */
export function ResendConfirmationButton({
  orderId,
  storeSlug,
  ink,
}: {
  orderId: string;
  storeSlug: string;
  ink: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    if (state !== "idle") return;
    setState("sending");
    const result = await resendOrderConfirmationEmail(orderId, storeSlug);
    if (result.success) {
      setState("sent");
      toast.success("Confirmation email sent — check your inbox.");
    } else {
      setState("idle");
      toast.error(result.error || "Couldn't resend the email. Try again shortly.");
    }
  }

  if (state === "sent") {
    return (
      <p style={{ opacity: 0.6 }} className="flex items-center justify-center gap-1.5 text-xs">
        <Check className="h-3.5 w-3.5" /> Confirmation email sent
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "sending"}
      style={{ color: ink, opacity: 0.6 }}
      className="mx-auto flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-40"
    >
      <Mail className="h-3.5 w-3.5" />
      {state === "sending" ? "Sending…" : "Didn't get an email? Resend confirmation"}
    </button>
  );
}
