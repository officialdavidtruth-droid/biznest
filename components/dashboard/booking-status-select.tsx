"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBookingStatus } from "@/lib/actions/booking";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

// The three states an admin can move a booking between from here. PENDING
// is included as a real, selectable option (not just a disabled
// placeholder) so a booking can be reopened back to pending after being
// confirmed or cancelled, not just moved forward.
const SELECTABLE_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;

export function BookingStatusSelect({
  slug,
  bookingId,
  status,
}: {
  slug: string;
  bookingId: string;
  status: string;
}) {
  const [current, setCurrent] = useState(status);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (next === current) return;
    const previous = current;
    setCurrent(next); // optimistic
    startTransition(async () => {
      const result = await updateBookingStatus(slug, bookingId, next as "PENDING" | "CONFIRMED" | "CANCELLED");
      if (!result.success) {
        setCurrent(previous);
        toast.error(result.error || "Couldn't update booking status.");
      } else {
        toast.success(`Booking marked ${next.toLowerCase()}.`);
      }
    });
  }

  return (
    <select
      value={current}
      disabled={isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium disabled:opacity-60 ${STATUS_STYLES[current] ?? "bg-muted text-muted-foreground"}`}
    >
      {/* A booking that's already COMPLETED isn't one of the three
          selectable targets here — show it as-is, disabled, rather than
          silently offering to move a completed booking back to
          pending/confirmed. */}
      {current === "COMPLETED" && (
        <option value="COMPLETED" disabled>
          Completed
        </option>
      )}
      {SELECTABLE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
