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

// Targets an owner can move a booking to from here. PENDING is deliberately
// excluded — updateBookingStatus() only accepts these three, and a booking
// arrives at PENDING on its own; this control moves it forward or cancels
// it, it doesn't reset it back.
const SELECTABLE_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED"] as const;

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
    const previous = current;
    setCurrent(next); // optimistic
    startTransition(async () => {
      const result = await updateBookingStatus(slug, bookingId, next as "CONFIRMED" | "COMPLETED" | "CANCELLED");
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
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium disabled:opacity-60 ${STATUS_STYLES[current] ?? "bg-muted text-muted-foreground"}`}
    >
      {/* Booking is still PENDING and hasn't been acted on yet — show it as
          the current selection, but it isn't a valid target so it's disabled;
          picking one of the real options below replaces it. */}
      {current === "PENDING" && (
        <option value="PENDING" disabled>
          Pending
        </option>
      )}
      {SELECTABLE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0) + s.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
          }

