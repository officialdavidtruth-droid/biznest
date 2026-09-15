import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Mail, MapPin, Phone, Users } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreBookingDetails } from "@/lib/actions/account";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";

function money(value: unknown, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}
function date(value: Date | string | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }
  ).format(new Date(value));
}

export default async function BookingDetailsPage({ params }: { params: Promise<{ slug: string; bookingId: string }> }) {
  const { slug, bookingId } = await params;
  const [store, bookingResult, hotel] = await Promise.all([
    getStoreBranding(slug),
    getStoreBookingDetails(slug, bookingId),
    getHotelContent(slug),
  ]);
  const booking: any = bookingResult;
  if (!store || !booking) notFound();
  const hero = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || null;
  const nights = booking.checkIn && booking.checkOut
    ? Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000))
    : null;
  const staff = booking.staff?.user?.name || booking.staff?.invitedName;

  return (
    <div className="veloura-account-content">
      <VelouraAccountHero title="Booking Details" subtitle="Everything you need for your reservation, in one place." image={hero} />
      <div className="veloura-detail-back"><Link href={`/store/${slug}/account/bookings`}><ArrowLeft size={16} /> Back to bookings</Link></div>

      <section className="veloura-booking-detail-head">
        <div>
          <span className="veloura-badge">{booking.status}</span>
          <h2>{booking.service.name}</h2>
          <p>Reservation ID <strong>{booking.id}</strong></p>
        </div>
        <div className="veloura-booking-detail-price">
          <span>Total</span>
          <strong>{money(booking.paymentAmount ?? booking.service.price, booking.paymentCurrency || booking.service.currency || "NGN")}</strong>
          <small>{booking.paymentStatus === "PAID" ? "Payment confirmed" : "Payment pending"}</small>
        </div>
      </section>

      <div className="veloura-booking-detail-grid">
        <section className="veloura-panel">
          <div className="veloura-panel-head"><h2>Stay information</h2><CheckCircle2 size={19} /></div>
          <div className="veloura-detail-cards">
            <div><CalendarDays /><span>Check-in</span><strong>{date(booking.checkIn || booking.scheduledAt, true)}</strong></div>
            <div><CalendarDays /><span>Check-out</span><strong>{date(booking.checkOut, true)}</strong></div>
            <div><Clock3 /><span>Duration</span><strong>{nights ? `${nights} night${nights === 1 ? "" : "s"}` : `${booking.durationMins} minutes`}</strong></div>
            <div><Users /><span>Guests</span><strong>{booking.partySize || "—"}</strong></div>
          </div>
          {booking.unit?.name && <div className="veloura-detail-note"><strong>Room</strong><span>{booking.unit.name}</span></div>}
          {staff && <div className="veloura-detail-note"><strong>Assigned to</strong><span>{staff}{booking.staff?.position ? ` · ${booking.staff.position}` : ""}</span></div>}
        </section>

        <aside className="veloura-panel">
          <div className="veloura-panel-head"><h2>Guest details</h2></div>
          <div className="veloura-detail-stack">
            <div><strong>Name</strong><span>{booking.guestName || "Account holder"}</span></div>
            {booking.guestEmail && <div><Mail /><span>{booking.guestEmail}</span></div>}
            {booking.guestPhone && <div><Phone /><span>{booking.guestPhone}</span></div>}
            <div><span>Booked {date(booking.createdAt)}</span></div>
          </div>
        </aside>
      </div>

      {(booking.notes || booking.specialRequests?.length) && (
        <section className="veloura-panel veloura-detail-wide">
          <div className="veloura-panel-head"><h2>Special requests</h2></div>
          {booking.notes && <p>{booking.notes}</p>}
          {booking.specialRequests?.length ? <ul>{booking.specialRequests.map((item: string) => <li key={item}>{item}</li>)}</ul> : null}
        </section>
      )}

      <div className="veloura-detail-actions">
        <Link className="veloura-gold-btn" href={`/store/${slug}/account/messages`}>Contact the hotel</Link>
        <Link className="veloura-secondary-btn" href={`/store/${slug}/account/bookings`}>Back to bookings</Link>
      </div>
    </div>
  );
}