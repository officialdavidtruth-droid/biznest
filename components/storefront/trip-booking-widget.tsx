"use client";

import { useState, useTransition } from "react";
import { createTripBooking, getTripSeatsLeft } from "@/lib/actions/booking";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";
import { formatNumber } from "@/lib/i18n/locale";
import { MiniCalendar, dateLabel, localISODate } from "@/components/storefront/booking-widget";
import { TRIP_MAX_TRAVELERS, tripTotal, type TripPricing } from "@/lib/trip-booking";

/**
 * Booking for a travel package: pick a departure (or any date), choose how many
 * travelers, pay. Price is per person or a flat group price, set by the agency.
 */
export function TripBookingWidget({
  storeSlug, serviceId, serviceName, servicePrice, currency = "NGN", seats, pricing, departures,
  accent, ink, bg, radius, card, headlineFont, allowNotes = true, startOpen = false,
}: {
  storeSlug: string; serviceId: string; serviceName: string; servicePrice: number; currency?: string;
  seats: number; pricing: TripPricing; departures: string[];
  accent: string; ink: string; bg: string; radius: string; card?: string; headlineFont?: string;
  allowNotes?: boolean; startOpen?: boolean;
}) {
  const today = localISODate(new Date());
  const upcoming = departures.filter((d) => d >= today);
  const fixed = departures.length > 0;
  const [open, setOpen] = useState(startOpen);
  const [date, setDate] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [travelers, setTravelers] = useState(1);
  const [notes, setNotes] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { isSignedIn } = useShopAuthGate(storeSlug);

  const surface = card || bg;
  const total = tripTotal(servicePrice, pricing, travelers);
  const maxPeople = Math.max(1, Math.min(TRIP_MAX_TRAVELERS, left ?? seats));
  const guestOk = Boolean(guestName.trim() && guestEmail.trim() && guestPhone.trim());
  const canSubmit = Boolean(date && left && left >= travelers && (isSignedIn || guestOk));
  const box = { width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ink}2a`, background: "transparent", color: ink } as const;

  function pick(iso: string) {
    setDate(iso);
    setLeft(null);
    startTransition(async () => {
      const n = await getTripSeatsLeft(serviceId, iso);
      setLeft(n);
      setTravelers((t) => Math.max(1, Math.min(t, n || 1)));
    });
  }

  function submit() {
    if (!date) return;
    if (!isSignedIn && !guestOk) { toast.error("Enter your name, email and phone to continue."); return; }
    const guest = isSignedIn ? undefined : { name: guestName, email: guestEmail, phone: guestPhone };
    startTransition(async () => {
      const result = await createTripBooking(storeSlug, serviceId, date, travelers, notes, guest);
      if (!result.success) {
        toast.error(result.error);
        setLeft(await getTripSeatsLeft(serviceId, date));
        return;
      }
      setPaying(true);
      const payment = await startBookingPayment(storeSlug, result.data.bookingId, isSignedIn ? undefined : guestEmail, { inline: false });
      if (!payment.success) {
        setPaying(false);
        toast.error(payment.error);
        window.location.assign(`/store/${storeSlug}/booking/${result.data.bookingId}/confirmation?payment=failed`);
        return;
      }
      window.location.assign(payment.data.authorizationUrl);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginTop: 8, background: accent, color: bg, border: 0, padding: "11px 18px", borderRadius: radius, fontWeight: 750, fontSize: 13, cursor: "pointer" }}>
        Book this package
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, border: `1px solid ${ink}16`, borderRadius: radius, padding: 16, color: ink, background: surface, boxShadow: `0 12px 40px ${ink}0b` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", opacity: .55 }}>Book this trip</div>
          <div style={{ fontWeight: 800, marginTop: 3, fontFamily: headlineFont || undefined }}>{serviceName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800 }}>{currency} {formatNumber(total)}</div>
          <div style={{ fontSize: 11, opacity: .55 }}>{pricing === "group" ? "for the whole group" : `${currency} ${formatNumber(servicePrice)} per person`}</div>
        </div>
      </div>

      <div style={{ fontWeight: 750, fontSize: 13, margin: "14px 0 9px" }}>{fixed ? "Choose a departure" : "Travel date"}</div>
      {fixed ? (
        upcoming.length === 0 ? (
          <div style={{ padding: 14, border: `1px dashed ${ink}22`, borderRadius: 10, fontSize: 12, opacity: .65 }}>No upcoming departures right now — please get in touch to arrange one.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 }}>
            {upcoming.map((d) => (
              <button key={d} type="button" onClick={() => pick(d)} style={{ padding: "10px 6px", borderRadius: 9, border: `1px solid ${date === d ? accent : ink + "1f"}`, background: date === d ? accent : "transparent", color: date === d ? "#fff" : ink, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {dateLabel(d)}
              </button>
            ))}
          </div>
        )
      ) : (
        <MiniCalendar selected={date} minDate={today} accent={accent} ink={ink} onSelect={pick} />
      )}

      {date && (
        <>
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: left !== null && left <= 5 ? 750 : 500, color: left !== null && left <= 5 ? accent : undefined, opacity: left === null ? .55 : 1 }}>
            {left === null ? "Checking seats…" : left === 0 ? "Fully booked on this date — choose another." : `${left} seat${left === 1 ? "" : "s"} left on ${dateLabel(date)}`}
          </div>

          {left ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <div style={{ fontWeight: 750, fontSize: 13 }}>Travelers</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" aria-label="Fewer travelers" disabled={travelers <= 1} onClick={() => setTravelers((t) => Math.max(1, t - 1))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${ink}2a`, background: "transparent", color: ink, cursor: "pointer", fontSize: 16 }}>−</button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{travelers}</span>
                  <button type="button" aria-label="More travelers" disabled={travelers >= maxPeople} onClick={() => setTravelers((t) => Math.min(maxPeople, t + 1))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${ink}2a`, background: "transparent", color: ink, cursor: "pointer", fontSize: 16 }}>+</button>
                </div>
              </div>

              <div style={{ borderRadius: 11, background: `${ink}06`, padding: 12, fontSize: 12, lineHeight: 1.8, marginTop: 12 }}>
                <div><b>{serviceName}</b></div>
                <div>{dateLabel(date)} · {travelers} traveler{travelers === 1 ? "" : "s"}</div>
                <div style={{ fontWeight: 800, marginTop: 3 }}>Total: {currency} {formatNumber(total)}</div>
              </div>

              {!isSignedIn && (
                <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Lead traveler's full name" style={box} />
                  <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email for your receipt" style={box} />
                  <input inputMode="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Phone number" style={box} />
                </div>
              )}
              {allowNotes && <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Passport names, pickup point, special requests… (optional)" rows={3} style={{ ...box, marginTop: 10, resize: "vertical" }} />}

              <button onClick={submit} disabled={isPending || paying || !canSubmit} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: radius, padding: "12px", background: accent, color: bg, fontWeight: 800, fontSize: 13, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : .55 }}>
                {paying ? "Opening payment…" : isPending ? "Securing your seats…" : `Confirm & pay · ${currency} ${formatNumber(total)}`}
              </button>
              <div style={{ marginTop: 8, fontSize: 10.5, textAlign: "center", opacity: .5 }}>Seats are held for a short time while you pay.</div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
