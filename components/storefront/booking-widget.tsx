"use client";

import { useState, useTransition } from "react";
import { getAvailableSlots, createBooking } from "@/lib/actions/booking";
import { toast } from "sonner";

function nextNDays(n: number): { iso: string; label: string }[] {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

export function BookingWidget({
  storeSlug,
  serviceId,
  serviceName,
  accent,
  ink,
  bg,
  radius,
  startOpen = false,
}: {
  storeSlug: string;
  serviceId: string;
  serviceName: string;
  accent: string;
  ink: string;
  bg: string;
  radius: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const days = nextNDays(10);

  function pickDate(iso: string) {
    setDate(iso);
    setSelectedTime(null);
    setSlots(null);
    startTransition(async () => {
      const result = await getAvailableSlots(serviceId, iso);
      setSlots(result);
    });
  }

  function book() {
    if (!date || !selectedTime) return;
    startTransition(async () => {
      const result = await createBooking(storeSlug, serviceId, date, selectedTime, notes);
      if (!result.success) {
        toast.error(result.error);
        if (date) pickDate(date); // refresh slots — someone else may have taken it
        return;
      }
      setConfirmed(true);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ marginTop: 8, background: accent, color: bg, border: 0, padding: "9px 16px", borderRadius: radius, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
      >
        Check availability
      </button>
    );
  }

  if (confirmed) {
    return (
      <div style={{ marginTop: 10, fontSize: 13, color: ink, opacity: 0.85 }}>
        ✓ Booked for {date} at {selectedTime}. The vendor will confirm shortly.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, background: `${ink}0d`, borderRadius: radius, padding: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Pick a date</p>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => pickDate(d.iso)}
            style={{
              flexShrink: 0, fontSize: 11, padding: "6px 10px", borderRadius: 8, cursor: "pointer",
              border: date === d.iso ? `1.5px solid ${accent}` : `1px solid ${ink}33`,
              background: date === d.iso ? `${accent}22` : "transparent", color: ink,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {date && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Pick a time</p>
          {slots === null ? (
            <p style={{ fontSize: 12, opacity: 0.6 }}>Loading…</p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.6 }}>No open slots this day — try another date.</p>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedTime(s)}
                  style={{
                    fontSize: 11.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    border: selectedTime === s ? `1.5px solid ${accent}` : `1px solid ${ink}33`,
                    background: selectedTime === s ? accent : "transparent",
                    color: selectedTime === s ? bg : ink, fontWeight: selectedTime === s ? 700 : 400,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTime && (
        <div style={{ marginTop: 10 }}>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the vendor should know? (optional)"
            style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ink}33`, background: "transparent", color: ink }}
          />
          <button
            onClick={book}
            disabled={isPending}
            style={{ marginTop: 8, width: "100%", background: accent, color: bg, border: 0, padding: "10px", borderRadius: radius, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? "Booking…" : `Confirm ${serviceName} — ${date} ${selectedTime}`}
          </button>
        </div>
      )}
    </div>
  );
}
