"use client";

import { CalendarDays, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/list-toolbar";

/**
 * Client-side wrapper around the plain-bookings stat row. StatCard is a
 * Client Component, and Server Components can't pass raw icon component
 * references as props across that boundary (only rendered elements or
 * plain data) -- so the icons are chosen in here instead of in the server
 * page, keeping bookings/page.tsx passing only plain numbers down.
 */
export function BookingStatCards({
  total,
  pending,
  confirmed,
  completed,
}: {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={CalendarDays} tone="purple" label="Total Bookings" value={total} note="All time" />
      <StatCard icon={Clock3} tone="orange" label="Pending" value={pending} note="Awaiting confirmation" />
      <StatCard icon={CheckCircle2} tone="green" label="Confirmed" value={confirmed} note="Upcoming" />
      <StatCard icon={XCircle} tone="blue" label="Completed" value={completed} note="Finished bookings" />
    </div>
  );
}
