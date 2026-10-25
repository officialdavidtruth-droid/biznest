"use client";

import { BedDouble, CalendarCheck, LogIn, LogOut } from "lucide-react";
import { StatCard } from "@/components/dashboard/list-toolbar";
import type { OccupancyStats } from "@/lib/actions/occupancy";

/** In-house and booked-tonight percentages for the hotel, plus today's arrivals and departures. */
export function OccupancyCards({ stats }: { stats: OccupancyStats }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={BedDouble} tone="green" label="In-house" value={`${stats.inHousePct}%`} note={`${stats.inHouse} of ${stats.totalUnits} rooms occupied now`} />
      <StatCard icon={CalendarCheck} tone="purple" label="Booked tonight" value={`${stats.bookedTonightPct}%`} note={`${stats.bookedTonight} of ${stats.totalUnits} rooms reserved`} />
      <StatCard icon={LogIn} tone="orange" label="Arrivals today" value={stats.arrivalsToday} note="Check-ins expected" />
      <StatCard icon={LogOut} tone="blue" label="Departures today" value={stats.departuresToday} note="Guests checking out" />
    </div>
  );
}
