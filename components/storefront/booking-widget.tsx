"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createBooking,
  createStayBooking,
  getAvailableSlots,
  getAvailableUnitCount,
  getBookableStaff,
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
}) {
  const [open, setOpen] = useState(startOpen);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<string>(localISODate(new Date()));
  const [checkOut, setCheckOut] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string; position: string | null }>>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [availableUnits, setAvailableUnits] = useState<number | null>(null);
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
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(localISODate(new Date()), i)), []);
  const nights = checkOut && date ? Math.max(1, Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000)) : 0;
  const total = unitBased ? servicePrice * Math.max(1, nights) : servicePrice;

  function selectDate(iso: string) {
    setDate(iso);
    setSelectedTime(null);
    setSlots(null);
    setAvailableUnits(null);
    setStep(2);
    startTransition(async () => {
      if (unitBased) {
        setCheckOut("");
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
    startTransition(async () => {
      setAvailableUnits(await getAvailableUnitCount(serviceId, date, iso));
    });
    setStep(3);
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

    startTransition(async () => {
      const result = unitBased
        ? await createStayBooking(storeSlug, serviceId, date, checkOut, notes, guest)
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 7 }}>
            {dates.map((d) => (
              <button key={d} onClick={() => selectDate(d)} style={{ padding: "9px 5px", borderRadius: 10, border: `1px solid ${date === d ? accent : ink + "1f"}`, background: date === d ? `${accent}16` : "transparent", color: ink, cursor: "pointer" }}>
                <div style={{ fontSize: 10, opacity: .55 }}>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div style={{ fontWeight: 800, marginTop: 2 }}>{new Date(`${d}T12:00:00`).getDate()}</div>
                <div style={{ fontSize: 9.5, opacity: .55 }}>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && unitBased && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 9 }}>Check-out</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 7 }}>
            {dates.filter((d) => d > date).map((d) => (
              <button key={d} onClick={() => selectCheckout(d)} style={{ padding: "9px 5px", borderRadius: 10, border: `1px solid ${checkOut === d ? accent : ink + "1f"}`, background: checkOut === d ? `${accent}16` : "transparent", color: ink, cursor: "pointer" }}>
                <div style={{ fontSize: 10, opacity: .55 }}>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div style={{ fontWeight: 800, marginTop: 2 }}>{new Date(`${d}T12:00:00`).getDate()}</div>
                <div style={{ fontSize: 9.5, opacity: .55 }}>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</div>
              </button>
            ))}
          </div>
          {availableUnits !== null && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: .7 }}>
              {availableUnits ? `${availableUnits} unit${availableUnits === 1 ? "" : "s"} available` : "No availability for these dates."}
            </div>
          )}
        </>
      )}

      {step === 2 && !unitBased && (
        <>
          <div style={{ fontWeight: 750, fontSize: 13, marginBottom: 9 }}>Available times · {dateLabel(date)}</div>
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
  
