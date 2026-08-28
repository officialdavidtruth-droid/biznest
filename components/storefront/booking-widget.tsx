"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createBooking,
  createStayBooking,
  getAvailableSlots,
  getAvailableUnitCount,
  getBookableStaff,
  getNextAvailableStay,
} from "@/lib/actions/booking";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";

function localISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, amount: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localISODate(d);
}

function dateLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

/**
 * A real month calendar (not just a horizontal scroll of the next 14 days),
 * so a shopper can pick any check-in date directly -- including dates
 * further out than two weeks -- the way they would on any hotel or
 * appointment site.
 */
function MiniCalendar({
  selected,
  minDate,
  accent,
  ink,
  onSelect,
}: {
  selected: string | null;
  minDate: string;
  accent: string;
  ink: string;
  onSelect: (iso: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => monthKey(selected || minDate));

  const [y, m] = viewMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const mo = String(m).padStart(2, "0");
      return `${y}-${mo}-${day}`;
    }),
  ];
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shiftMonth(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" onClick={() => shiftMonth(-1)} style={{ border: 0, background: "transparent", color: ink, opacity: .6, cursor: "pointer", fontSize: 14, padding: 4 }} aria-label="Previous month">‹</button>
        <div style={{ fontSize: 12, fontWeight: 750 }}>{monthLabel}</div>
        <button type="button" onClick={() => shiftMonth(1)} style={{ border: 0, background: "transparent", color: ink, opacity: .6, cursor: "pointer", fontSize: 14, padding: 4 }} aria-label="Next month">›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 3, marginBottom: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5, opacity: .45, fontWeight: 700 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 3 }}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const disabled = iso < minDate;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(iso)}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                border: `1px solid ${isSelected ? accent : "transparent"}`,
                background: isSelected ? accent : "transparent",
                color: disabled ? `${ink}33` : isSelected ? "#fff" : ink,
                fontSize: 11.5,
                fontWeight: isSelected ? 800 : 500,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {Number(iso.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingWidget({
  storeSlug,
  serviceId,
  serviceName,
  servicePrice,
  currency = "NGN",
  durationMins,
  totalUnits,
  accent,
  ink,
  bg,
  radius,
  card,
  headlineFont,
  startOpen = false,
  unitLabel = "unit",
  otherOptionsHref,
}: {
  storeSlug: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  currency?: string;
  durationMins?: number | null;
  totalUnits?: number | null;
  accent: string;
  ink: string;
  bg: string;
  radius: string;
  /** Card surface color -- distinct from `bg` on templates with a tinted page
   * background (e.g. Maison, Ember), so the widget reads as a raised card
   * instead of blending into the page. Falls back to `bg` when omitted. */
  card?: string;
  /** Template's display/headline font, applied to the booking name and
   * section titles so the widget matches the rest of that template's
   * typographic identity instead of inheriting the page's body font
   * everywhere. Falls back to the ambient font when omitted. */
  headlineFont?: string;
  startOpen?: boolean;
  /** Noun used for a single bookable unit -- "room" for hotel stays,
   * "table" for a restaurant, "bay" for a wash bay, etc. Falls back to the
   * generic "unit" for any other unit-based service. */
  unitLabel?: string;
  /** Where the shopper can browse other bookable options for this business
   * (e.g. the rooms grid, or a services listing) when their preferred dates
   * are tight or fully booked. */
  otherOptionsHref?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string>(localISODate(new Date()));
  const [checkOut, setCheckOut] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string; position: string | null }>>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [availableUnits, setAvailableUnits] = useState<number | null>(null);
  const [nextAvailable, setNextAvailable] = useState<{ checkIn: string; checkOut: string } | null | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [paymentStarted, setPaymentStarted] = useState(false);
  const { isSignedIn } = useShopAuthGate(storeSlug);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const surface = card || bg;
  const titleFont = headlineFont || undefined;
  const unitBased = Boolean(totalUnits);
  const nights = checkOut && date ? Math.max(1, Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000)) : 0;
  const total = unitBased ? servicePrice * Math.max(1, nights) : servicePrice;

  function selectDate(iso: string) {
    setDate(iso);
    setSelectedTime(null);
    setSlots(null);
    setAvailableUnits(null);
    setNextAvailable(undefined);
    setStep(2);
    startTransition(async () => {
      if (unitBased) {
        setCheckOut("");
        // Preview tonight's availability immediately, before the shopper
        // has picked a check-out date, so they see how many rooms/units
        // are left right away instead of several taps later.
        const count = await getAvailableUnitCount(serviceId, iso, addDays(iso, 1));
        setAvailableUnits(count);
        if (count === 0) {
          setNextAvailable(await getNextAvailableStay(serviceId, iso, addDays(iso, 1)));
        }
        return;
      }
      const [available, people] = await Promise.all([
        getAvailableSlots(serviceId, iso),
        getBookableStaff(serviceId),
      ]);
      setSlots(available);
      setStaff(people);
    });
  }

  function selectCheckout(iso: string) {
    if (iso <= date) return;
    setCheckOut(iso);
    setNextAvailable(undefined);
    startTransition(async () => {
      const count = await getAvailableUnitCount(serviceId, date, iso);
      setAvailableUnits(count);
      if (count === 0) {
        setNextAvailable(await getNextAvailableStay(serviceId, date, iso));
      }
    });
    setStep(3);
  }

  function useSuggestedDates() {
    if (!nextAvailable) return;
    setDate(nextAvailable.checkIn);
    setCheckOut("");
    setNextAvailable(undefined);
    setAvailableUnits(null);
    startTransition(async () => {
      const count = await getAvailableUnitCount(serviceId, nextAvailable.checkIn, nextAvailable.checkOut);
      setAvailableUnits(count);
      setCheckOut(nextAvailable.checkOut);
      setStep(3);
    });
  }

  function selectTime(time: string) {
    setSelectedTime(time);
    setStep(staff.length ? 3 : 4);
  }

  function guestFieldsValid() {
    return Boolean(guestName.trim() && guestEmail.trim() && guestPhone.trim());
  }

  function submit() {
    if (!isSignedIn && !guestFieldsValid()) {
      toast.error("Enter your name, email and phone to continue.");
      return;
    }
    const guest = isSignedIn ? undefined : { name: guestName, email: guestEmail, phone: guestPhone };
    const finalNotes = unitBased && checkInTime
      ? `Preferred check-in time: ${checkInTime}${notes ? `\n${notes}` : ""}`
      : notes;

    startTransition(async () => {
      const result = unitBased
        ? await createStayBooking(storeSlug, serviceId, date, checkOut, finalNotes, guest)
        : await createBooking(storeSlug, serviceId, date, selectedTime || "", notes, guest, selectedStaff || undefined);

      if (!result.success) {
        toast.error(result.error);
        if (!unitBased && date) {
          const [available, people] = await Promise.all([getAvailableSlots(serviceId, date), getBookableStaff(serviceId)]);
          setSlots(available);
          setStaff(people);
        }
        return;
      }

      const newBookingId = result.data.bookingId;
      setBookingId(newBookingId);

      if (total <= 0) {
        setConfirmed(true);
        return;
      }

      setPaymentStarted(true);
      const payment = await startBookingPayment(storeSlug, newBookingId, isSignedIn ? undefined : guestEmail);
      if (!payment.success) {
        toast.error(payment.error);
        setPaymentStarted(false);
        setConfirmed(true);
        return;
      }
      window.location.assign(payment.data.authorizationUrl);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ marginTop: 8, background: accent, color: bg, border: 0, padding: "11px 18px", borderRadius: radius, fontWeight: 750, fontSize: 13, cursor: "pointer" }}
      >
        Book now
      </button>
    );
  }

  if (confirmed) {
    return (
      <div style={{ marginTop: 12, border: `1px solid ${ink}18`, borderRadius: radius, padding: 18, color: ink, background: surface }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
        <strong style={{ fontSize: 16, fontFamily: titleFont }}>Booking request received</strong>
        <p style={{ marginTop: 7, fontSize: 13, opacity: .7, lineHeight: 1.6 }}>
          Your {serviceName} booking has been created{bookingId ? ` (#${bookingId.slice(-6).toUpperCase()})` : ""}. You can view its status — and pay if needed — from your account.
        </p>
      </div>
    );
  }

  const progress = unitBased
    ? ["Dates", "Stay details", "Review"]
    : ["Date", "Time", ...(staff.length ? ["Specialist"] : []), "Review"];
  const reviewReady = unitBased
    ? Boolean(checkOut && availableUnits !== 0)
    : Boolean(selectedTime && (!staff.length || selectedStaff));
  const canSubmit = reviewReady && (isSignedIn || guestFieldsValid());

  return (
    <div style={{ marginTop: 12, border: `1px solid ${ink}16`, borderRadius: radius, padding: 16, color: ink, background: surface, boxShadow: `0 12px 40px ${ink}0b` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", opacity: .55 }}>Booking</div>
          <div style={{ fontWeight: 800, marginTop: 3, fontFamily: titleFont }}>{serviceName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800 }}>{currency} {total.toLocaleString()}</div>
          <div style={{ fontSize: 11, opacity: .55 }}>{unitBased ? (nights ? `${nights} night${nights === 1 ? "" : "s"}` : "per night") : `${durationMins ?? ""} min`}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, margin: "16px 0" }}>
        {progress.map((p, i) => (
          <div key={p} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 3, background: i + 1 <= step ? accent : `${ink}14` }} />
            <div style={{ fontSize: 9.5, marginTop: 5, opacity: i + 1 === step ? 1 : .45 }}>{p}</div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 9 }}>{unitBased ? "Check-in" : "Choose a date"}</div>
          <MiniCalendar selected={date || null} minDate={localISODate(new Date())} accent={accent} ink={ink} onSelect={selectDate} />
          {unitBased && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 750, fontSize: 12.5, marginBottom: 6 }}>Preferred arrival time <span style={{ opacity: .5, fontWeight: 500 }}>(optional)</span></div>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "9px 10px", borderRadius: 8, border: `1px solid ${ink}2a`, background: "transparent", color: ink }}
              />
            </div>
          )}
        </>
      )}

      {step === 2 && unitBased && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 9 }}>Check-out</div>
          <MiniCalendar selected={checkOut || null} minDate={addDays(date, 1)} accent={accent} ink={ink} onSelect={selectCheckout} />

          {availableUnits !== null && availableUnits > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: "11px 13px",
                borderRadius: 10,
                background: availableUnits <= 3 ? `${accent}12` : `${ink}06`,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: availableUnits <= 3 ? 750 : 500, color: availableUnits <= 3 ? accent : ink }}>
                {availableUnits} {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}{availableUnits === 1 ? "" : "s"} Left for {serviceName}
              </span>
              {checkOut && availableUnits <= 8 && otherOptionsHref && (
                <div style={{ marginTop: 5 }}>
                  <Link href={otherOptionsHref} style={{ color: accent, fontWeight: 700, textDecoration: "underline" }}>
                    Would you like to see other {unitLabel} options?
                  </Link>
                </div>
              )}
            </div>
          )}

          {availableUnits === 0 && (
            <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, background: `${ink}06`, fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 750, opacity: 0.85 }}>No {unitLabel}s left for {serviceName} on these dates.</div>
              {nextAvailable === undefined ? (
                <span style={{ opacity: 0.6 }}>Checking the next open dates…</span>
              ) : nextAvailable ? (
                <>
                  <div style={{ opacity: 0.7, marginTop: 8 }}>Next open dates:</div>
                  <div style={{ fontWeight: 800, marginTop: 3 }}>
                    {dateLabel(nextAvailable.checkIn)} → {dateLabel(nextAvailable.checkOut)}
                  </div>
                  <button
                    onClick={useSuggestedDates}
                    style={{ marginTop: 8, border: 0, borderRadius: 8, padding: "8px 12px", background: accent, color: bg, fontWeight: 800, fontSize: 11.5, cursor: "pointer" }}
                  >
                    Use these dates
                  </button>
                </>
              ) : (
                <span style={{ opacity: 0.7 }}>No open dates in the next couple of months.</span>
              )}
              {otherOptionsHref && (
                <div style={{ marginTop: 8 }}>
                  <Link href={otherOptionsHref} style={{ color: accent, fontWeight: 700, textDecoration: "underline" }}>
                    See other {unitLabel} options →
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 2 && !unitBased && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 3 }}>Available times · {dateLabel(date)}</div>
          {slots !== null && slots.length > 0 && (
            <div style={{ fontSize: 11.5, marginBottom: 9, fontWeight: slots.length <= 3 ? 750 : 500, color: slots.length <= 3 ? accent : undefined, opacity: slots.length <= 3 ? 1 : .6 }}>
              {slots.length} slot{slots.length === 1 ? "" : "s"} left on this date
            </div>
          )}
          {slots === null ? (
            <div style={{ padding: 14, opacity: .55, fontSize: 12 }}>Checking availability…</div>
          ) : slots.length === 0 ? (
            <div style={{ padding: 14, border: `1px dashed ${ink}22`, borderRadius: 10, fontSize: 12, opacity: .65 }}>No appointments available on this date. Choose another day.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7 }}>
              {slots.map((s) => (
                <button key={s} onClick={() => selectTime(s)} style={{ padding: "10px 6px", borderRadius: 9, border: `1px solid ${selectedTime === s ? accent : ink + "1f"}`, background: selectedTime === s ? accent : "transparent", color: selectedTime === s ? bg : ink, fontWeight: 700, cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 3 && !unitBased && staff.length > 0 && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 9 }}>Choose a specialist</div>
          <div style={{ display: "grid", gap: 8 }}>
            {staff.map((person) => (
              <button key={person.id} onClick={() => { setSelectedStaff(person.id); setStep(4); }} style={{ textAlign: "left", padding: 12, borderRadius: 11, border: `1px solid ${selectedStaff === person.id ? accent : ink + "1f"}`, background: selectedStaff === person.id ? `${accent}12` : "transparent", color: ink, cursor: "pointer" }}>
                <div style={{ fontWeight: 750 }}>{person.name}</div>
                {person.position && <div style={{ fontSize: 11, opacity: .55, marginTop: 2 }}>{person.position}</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {((step === 3 && unitBased) || step === 4) && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 10, fontFamily: titleFont }}>Review your booking</div>
          <div style={{ borderRadius: 11, background: `${ink}06`, padding: 12, fontSize: 12, lineHeight: 1.8 }}>
            <div><b>{serviceName}</b></div>
            <div>{unitBased ? `${dateLabel(date)} → ${dateLabel(checkOut)} · ${nights} night${nights === 1 ? "" : "s"}` : `${dateLabel(date)} · ${selectedTime}`}</div>
            {selectedStaff && <div>{staff.find((s) => s.id === selectedStaff)?.name ?? "Specialist"} selected</div>}
            <div style={{ fontWeight: 800, marginTop: 3 }}>Total: {currency} {total.toLocaleString()}</div>
          </div>

          {!isSignedIn && (
            <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your full name" style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ink}33`, background: "transparent", color: ink }} />
              <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email for your receipt" style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ink}33`, background: "transparent", color: ink }} />
              <input inputMode="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Phone number" style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${ink}33`, background: "transparent", color: ink }} />
            </div>
          )}

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you'd like the business to know? (optional)" rows={3} style={{ width: "100%", marginTop: 10, resize: "vertical", padding: 10, borderRadius: 10, border: `1px solid ${ink}1f`, background: "transparent", color: ink, fontSize: 12 }} />

          <button onClick={submit} disabled={isPending || !canSubmit} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: radius, padding: "12px", background: accent, color: bg, fontWeight: 800, cursor: isPending ? "wait" : "pointer", opacity: isPending || !canSubmit ? .65 : 1 }}>
            {paymentStarted ? "Opening payment…" : isPending ? "Securing your booking…" : `Confirm booking · ${currency} ${total.toLocaleString()}`}
          </button>
          {isSignedIn && <div style={{ marginTop: 8, fontSize: 10.5, textAlign: "center", opacity: .5 }}>You'll be asked to pay to confirm your slot.</div>}
        </>
      )}

      {step > 1 && (
        <button onClick={() => setStep(Math.max(1, step - 1))} style={{ marginTop: 12, border: 0, background: "transparent", color: ink, opacity: .55, fontSize: 11, cursor: "pointer" }}>
          ← Back
        </button>
      )}
    </div>
  );
  }
  
