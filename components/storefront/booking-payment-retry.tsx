"use client";

import { useState, useTransition } from "react";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { toast } from "sonner";

export function BookingPaymentRetry({
  storeSlug,
  bookingId,
  requiresGuestEmail,
  defaultEmail = "",
}: {
  storeSlug: string;
  bookingId: string;
  requiresGuestEmail?: boolean;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await startBookingPayment(storeSlug, bookingId, requiresGuestEmail ? email.trim() : undefined);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.location.assign(result.data.authorizationUrl);
    });
  }

  return (
    <div style={{ marginTop: 20 }}>
      {requiresGuestEmail && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email used for the booking"
          autoComplete="email"
          style={{ width: "100%", padding: "12px 14px", border: "1px solid #ddd8d0", borderRadius: 9, marginBottom: 10, fontSize: 13, boxSizing: "border-box" }}
        />
      )}
      <button
        type="button"
        onClick={retry}
        disabled={pending || (requiresGuestEmail && !email.trim())}
        style={{ width: "100%", padding: "13px 18px", border: 0, borderRadius: 9, background: "#171411", color: "#fff", fontWeight: 800, fontSize: 13, cursor: pending ? "wait" : "pointer", opacity: pending || (requiresGuestEmail && !email.trim()) ? .55 : 1 }}
      >
        {pending ? "Opening payment…" : "Try payment again"}
      </button>
    </div>
  );
}
