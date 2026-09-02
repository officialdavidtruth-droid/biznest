"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, Users, Phone, ShieldCheck, BadgeCheck, Clock3, Headphones, Lock } from "lucide-react";
import { createStayBooking, getAvailableUnitCount } from "@/lib/actions/booking";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { formatMoney } from "@/lib/storefront/hero-media";
import { toast } from "sonner";

export type BookableAddon = {
  id: string;
  label: string;
  description?: string;
  /** per-booking or per-guest or per-night price, purely informational --
   * shown in the on-screen total, but NOT sent to payment. Selections are
   * appended to the booking notes so staff can see and manually invoice
   * them, keeping the actual charged amount equal to the server-verified
   * room total (see the recent Paystack amount-verification fix). */
  price: number;
};

type Theme = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  border?: string;
  muted?: string;
  radius: string;
  font: string;
  headlineFont: string;
};

type Props = {
  slug: string;
  theme: Theme;
  serviceId: string;
  serviceName: string;
  serviceDescription?: string | null;
  serviceImage: string | null;
  price: number;
  currency: string;
  guestCapacity?: string;
  bedType?: string;
  roomSize?: string;
  rateUnit?: string;
  itemLabelSingular?: string;
  amenities?: string[];
  addons?: BookableAddon[];
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  changeRoomHref?: string;
};

const STEPS = ["Room & Details", "Guest Information", "Add-ons (Optional)", "Review & Pay", "Confirmation"] as const;

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T12:00:00`).getTime();
  const b = new Date(`${checkOut}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

export function BookingFlowWizard({
  slug, theme, serviceId, serviceName, serviceDescription, serviceImage, price, currency,
  guestCapacity, bedType, roomSize, rateUnit = "night", itemLabelSingular = "Room", amenities = [],
  addons = [], defaultCheckIn = "", defaultCheckOut = "", defaultGuests = 2, changeRoomHref,
}: Props) {
  const { isSignedIn } = useShopAuthGate(slug);
  const [step, setStep] = useState(0);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(defaultGuests);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [availableUnits, setAvailableUnits] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;

  const nights = Math.max(1, nightsBetween(checkIn, checkOut));
  const roomSubtotal = price * nights;
  const addonSubtotal = addons.filter((a) => selectedAddons.includes(a.id)).reduce((sum, a) => sum + a.price, 0);
  const tax = Math.round((roomSubtotal + addonSubtotal) * 0.1);
  const total = roomSubtotal + addonSubtotal + tax;

  useEffect(() => {
    if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) <= 0) {
      setAvailableUnits(null);
      return;
    }
    let cancelled = false;
    getAvailableUnitCount(serviceId, checkIn, checkOut).then((count) => {
      if (!cancelled) setAvailableUnits(count);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, checkIn, checkOut]);

  function guestFieldsValid() {
    return Boolean(name.trim() && email.trim() && phone.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  }

  const datesValid = Boolean(checkIn && checkOut && nightsBetween(checkIn, checkOut) > 0);
  const canProceedToGuest = datesValid && availableUnits !== 0;
  const canProceedToReview = isSignedIn || guestFieldsValid();

  function submit() {
    if (!datesValid) {
      toast.error("Choose valid check-in and check-out dates.");
      setStep(0);
      return;
    }
    if (!isSignedIn && !guestFieldsValid()) {
      toast.error("Enter your name, valid email and phone number.");
      setStep(1);
      return;
    }
    const addonNote = selectedAddons.length
      ? `Add-ons requested: ${addons.filter((a) => selectedAddons.includes(a.id)).map((a) => a.label).join(", ")}`
      : "";
    const finalNotes = [addonNote, notes].filter(Boolean).join("\n");
    const guest = isSignedIn ? undefined : { name, email, phone };

    startTransition(async () => {
      const result = await createStayBooking(slug, serviceId, checkIn, checkOut, finalNotes, guest);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setBookingId(result.data.bookingId);

      if (roomSubtotal <= 0) {
        setConfirmed(true);
        setStep(4);
        return;
      }

      const payment = await startBookingPayment(slug, result.data.bookingId, isSignedIn ? undefined : email);
      if (!payment.success) {
        toast.error(payment.error);
        setConfirmed(true);
        setStep(4);
        return;
      }
      window.location.assign(payment.data.authorizationUrl);
    });
  }

  const inputStyle: React.CSSProperties = { width: "100%", border: `1px solid ${border}`, borderRadius: 8, padding: "11px 12px", fontSize: 13, background: theme.bg, color: ink, fontFamily: theme.font };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: ink, marginBottom: 6 };

  if (confirmed) {
    return (
      <div style={{ fontFamily: theme.font, color: ink, background: theme.bg, maxWidth: 640, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${accent}20`, color: accent, display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 26 }}>✓</div>
        <h2 style={{ fontFamily: theme.headlineFont, fontSize: 30, margin: "0 0 10px" }}>Booking request received</h2>
        <p style={{ color: muted, fontSize: 14, lineHeight: 1.7 }}>
          Your {serviceName} reservation{bookingId ? ` (#${bookingId.slice(-6).toUpperCase()})` : ""} has been created. You can review its status and complete payment any time from your account.
        </p>
        <Link href={`/store/${slug}`} style={{ display: "inline-block", marginTop: 20, padding: "12px 22px", background: accent, color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 13 }}>Back to home</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: theme.bg }}>
      {/* Stepper */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "26px 20px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, opacity: i > step ? 0.45 : 1 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: i <= step ? accent : `${ink}22`, color: i <= step ? "#fff" : ink, fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, fontWeight: i === step ? 800 : 600 }}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span style={{ width: 24, height: 1, background: `${ink}22` }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 100px", display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 30 }}>
          {/* Step 1: Room & details (always visible as a summary, like the reference) */}
          <section>
            <h3 style={{ fontFamily: theme.headlineFont, fontSize: 19, margin: "0 0 14px" }}>1. Your {itemLabelSingular} Selection</h3>
            <div style={{ display: "flex", gap: 16, border: `1px solid ${border}`, borderRadius: theme.radius, padding: 16, alignItems: "center", background: theme.card }}>
              <div style={{ width: 100, height: 76, borderRadius: 8, flexShrink: 0, background: serviceImage ? `url(${serviceImage}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontFamily: theme.headlineFont, fontSize: 16 }}>{serviceName}</strong>
                {serviceDescription && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: muted }}>{serviceDescription}</p>}
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: muted, flexWrap: "wrap" }}>
                  {bedType && <span>{bedType}</span>}
                  {guestCapacity && <span>{guestCapacity} Guests</span>}
                  {roomSize && <span>{roomSize} m²</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{formatMoney(price, currency)}</div>
                <div style={{ fontSize: 11, color: muted }}>/ {rateUnit}</div>
                {changeRoomHref && <Link href={changeRoomHref} style={{ display: "inline-block", marginTop: 8, fontSize: 11.5, fontWeight: 700, color: accent, textDecoration: "none" }}>Change {itemLabelSingular}</Link>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
              <div>
                <span style={labelStyle}><Calendar size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Check-in Date</span>
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}><Calendar size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Check-out Date</span>
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}><Users size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Guests</span>
                <input type="number" min={1} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} />
              </div>
            </div>
            {datesValid && availableUnits === 0 && (
              <p style={{ color: "#b42318", fontSize: 12.5, marginTop: 10 }}>No {itemLabelSingular.toLowerCase()}s of this type are available for those dates — try different dates.</p>
            )}
            {amenities.length > 0 && (
              <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", fontSize: 12, color: muted }}>
                {amenities.map((a) => <span key={a}>✓ {a}</span>)}
              </div>
            )}
          </section>

          {/* Step 2: Guest information */}
          {!isSignedIn && (
            <section>
              <h3 style={{ fontFamily: theme.headlineFont, fontSize: 19, margin: "0 0 14px" }}>2. Guest Information</h3>
              <p style={{ color: muted, fontSize: 12.5, margin: "0 0 14px" }}>Enter your details to complete the booking.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <span style={labelStyle}>Full Name *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" style={inputStyle} />
                </div>
                <div>
                  <span style={labelStyle}>Email Address *</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={labelStyle}><Phone size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Phone Number *</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 801 234 5678" style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={labelStyle}>Special Requests (Optional)</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} rows={3} placeholder="e.g. Early check-in, airport pickup, extra bed…" style={{ ...inputStyle, resize: "vertical" }} />
                  <div style={{ textAlign: "right", fontSize: 10.5, color: muted, marginTop: 4 }}>{notes.length}/200</div>
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Add-ons */}
          {addons.length > 0 && (
            <section>
              <h3 style={{ fontFamily: theme.headlineFont, fontSize: 19, margin: "0 0 6px" }}>3. Add-ons &amp; Extras (Optional)</h3>
              <p style={{ color: muted, fontSize: 12.5, margin: "0 0 14px" }}>Make your stay even more special.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {addons.map((addon) => {
                  const selected = selectedAddons.includes(addon.id);
                  return (
                    <label key={addon.id} style={{ border: `1px solid ${selected ? accent : border}`, borderRadius: 10, padding: 14, cursor: "pointer", display: "block", background: theme.card }}>
                      <input type="checkbox" checked={selected} onChange={() => setSelectedAddons((prev) => (selected ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]))} style={{ marginBottom: 8 }} />
                      <strong style={{ display: "block", fontSize: 13 }}>{addon.label}</strong>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: accent, margin: "4px 0" }}>{formatMoney(addon.price, currency)}</span>
                      {addon.description && <span style={{ fontSize: 11.5, color: muted }}>{addon.description}</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={isPending || !canProceedToGuest || !canProceedToReview}
              onClick={submit}
              style={{ padding: "14px 22px", borderRadius: 10, border: 0, background: accent, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: isPending ? "wait" : "pointer", opacity: !canProceedToGuest || !canProceedToReview ? 0.55 : 1, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Lock size={14} /> {isPending ? "Processing…" : "Proceed to Payment"}
            </button>
          </div>
        </div>

        {/* Booking summary sidebar */}
        <aside style={{ position: "sticky", top: 24, border: `1px solid ${border}`, borderRadius: theme.radius, padding: 22, background: theme.card, display: "grid", gap: 14 }}>
          <strong style={{ fontFamily: theme.headlineFont, fontSize: 17 }}>Booking Summary</strong>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 56, height: 44, borderRadius: 6, flexShrink: 0, background: serviceImage ? `url(${serviceImage}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})` }} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13, display: "block" }}>{serviceName}</strong>
              <span style={{ fontSize: 11.5, color: muted }}>{formatMoney(price, currency)} / {rateUnit}</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 12.5, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            <Row label="Check-in" value={checkIn || "—"} icon={<Calendar size={13} color={muted} />} />
            <Row label="Check-out" value={checkOut || "—"} icon={<Calendar size={13} color={muted} />} />
            <Row label="Nights" value={String(nights)} icon={<Clock3 size={13} color={muted} />} />
            <Row label="Guests" value={String(guests)} icon={<Users size={13} color={muted} />} />
          </div>
          <div style={{ display: "grid", gap: 6, fontSize: 12.5, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            <Row label={`${itemLabelSingular} Subtotal`} value={formatMoney(roomSubtotal, currency)} />
            <Row label="Add-ons" value={formatMoney(addonSubtotal, currency)} />
            <Row label="Taxes & Service Fee (10%)" value={formatMoney(tax, currency)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: `${accent}14`, borderRadius: 8, padding: "10px 12px", fontWeight: 800, fontSize: 14 }}>
            <span>Total Amount</span><span>{formatMoney(total, currency)}</span>
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 11.5, color: muted, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ShieldCheck size={14} /> Best Price Guarantee</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}><BadgeCheck size={14} /> Instant Confirmation</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}><Headphones size={14} /> 24/7 Support</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.75 }}>{icon}{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
