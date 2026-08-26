"use client";

import { useState } from "react";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

type Props = {
  initialMode?: "none" | "appointment" | "units";
  initialDurationMins?: number;
  initialTotalUnits?: number;
};

/**
 * Toggles between three booking setups for a service:
 *  - none: not bookable at all (plain product-like service)
 *  - appointment: single time-slot bookings against weekly working hours
 *    (haircuts, consultations)
 *  - units: N identical physical units booked by date range, with
 *    "X available" shown to the customer (hotel rooms, rental fleets)
 */
export function ServiceBookingModeField({
  initialMode = "appointment",
  initialDurationMins = 30,
  initialTotalUnits,
}: Props) {
  const [mode, setMode] = useState<"none" | "appointment" | "units">(initialMode);

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-2 text-sm font-medium">Booking</p>
      <div className="mb-4 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("none")}
          className={`rounded-md border px-3 py-1.5 ${mode === "none" ? "border-primary bg-primary/10 font-medium" : ""}`}
        >
          Not bookable
        </button>
        <button
          type="button"
          onClick={() => setMode("appointment")}
          className={`rounded-md border px-3 py-1.5 ${mode === "appointment" ? "border-primary bg-primary/10 font-medium" : ""}`}
        >
          Appointment
        </button>
        <button
          type="button"
          onClick={() => setMode("units")}
          className={`rounded-md border px-3 py-1.5 ${mode === "units" ? "border-primary bg-primary/10 font-medium" : ""}`}
        >
          Multiple units
        </button>
      </div>

      <input type="hidden" name="isBookable" value={mode === "appointment" ? "on" : ""} />

      {mode === "appointment" && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Customers pick a single time slot (e.g. a haircut or consultation).
          </p>
          <label className="mb-1 block text-xs text-muted-foreground">Appointment length (minutes)</label>
          <input name="durationMins" type="number" min="5" step="5" defaultValue={initialDurationMins} className="mb-4 w-full rounded-md border px-3 py-1.5 text-sm" />

          <p className="mb-2 text-xs font-medium">Working hours</p>
          <div className="space-y-2">
            {DAYS.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <label className="flex w-16 items-center gap-1.5 text-xs">
                  <input type="checkbox" name={`${d.key}-enabled`} defaultChecked={!["sat", "sun"].includes(d.key)} />
                  {d.label}
                </label>
                <input type="time" name={`${d.key}-start`} defaultValue="09:00" className="rounded-md border px-2 py-1 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <input type="time" name={`${d.key}-end`} defaultValue="17:00" className="rounded-md border px-2 py-1 text-xs" />
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "units" && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            For a category with several identical, always-available units — e.g. a "Deluxe Room" category
            with 12 rooms. Customers book by date range and see how many units are left; no working hours needed.
          </p>
          <label className="mb-1 block text-xs text-muted-foreground">Number of units</label>
          <input name="totalUnits" type="number" min="1" step="1" defaultValue={initialTotalUnits} placeholder="e.g. 12" className="w-full rounded-md border px-3 py-1.5 text-sm" />
        </>
      )}

      {mode === "none" && (
        <p className="text-xs text-muted-foreground">Customers won't be able to book a time or dates for this service.</p>
      )}
    </div>
  );
                                                                                     }

