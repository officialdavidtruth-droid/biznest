import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { BookingPaymentRetry } from "@/components/storefront/booking-payment-retry";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; bookingId: string }> }): Promise<Metadata> {
  const { slug, bookingId } = await params;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, store: { slug } },
    select: { service: { select: { name: true } }, store: { select: { name: true } } },
  });
  return booking ? { title: `Booking — ${booking.store.name}` } : { title: "Booking" };
}

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { slug, bookingId } = await params;
  const { payment } = await searchParams;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, store: { slug }, },
    include: { service: true, store: true },
  });
  if (!booking || booking.store.status !== "ACTIVE") notFound();

  const paid = booking.paymentStatus === "PAID";
  const failed = payment === "failed";
  const requiresGuestEmail = !booking.buyerId && Boolean(booking.guestEmail);
  const title = paid ? "Booking confirmed" : failed ? "Payment was not completed" : "Booking request received";
  const body = paid
    ? `Your ${booking.service.name} booking is confirmed. Your payment has been verified successfully.`
    : failed
      ? `Your ${booking.service.name} booking was saved, but the payment was not completed. You can return to the store and try again.`
      : `Your ${booking.service.name} booking has been created. Its current payment status is ${booking.paymentStatus.toLowerCase()}.`;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#faf9f7", color: "#171411", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 620, background: "#fff", border: "1px solid #e8e4de", borderRadius: 18, padding: "48px 32px", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.06)" }}>
        <div style={{ width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 18px", background: paid ? "#eaf7ef" : "#fff5e8", color: paid ? "#177245" : "#a15c00", fontSize: 27 }}>
          {paid ? "✓" : "!"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", opacity: .6 }}>Booking {booking.id.slice(-8).toUpperCase()}</div>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 1.05, margin: "12px 0" }}>{title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: "#69645d", maxWidth: 500, margin: "0 auto" }}>{body}</p>
        <div style={{ margin: "26px auto 0", padding: 18, borderRadius: 12, background: "#f7f5f1", textAlign: "left", fontSize: 13, lineHeight: 1.8 }}>
          <div><strong>Service:</strong> {booking.service.name}</div>
          {booking.checkIn && <div><strong>Check-in:</strong> {booking.checkIn.toLocaleDateString()}</div>}
          {booking.checkOut && <div><strong>Check-out:</strong> {booking.checkOut.toLocaleDateString()}</div>}
          <div><strong>Payment:</strong> {booking.paymentStatus}</div>
        </div>
        {!paid && failed && (
          <BookingPaymentRetry storeSlug={slug} bookingId={booking.id} requiresGuestEmail={requiresGuestEmail}  />
        )}
        <Link href={buildStoreUrl(booking.store)} style={{ display: "inline-block", marginTop: 24, padding: "13px 22px", borderRadius: 9, background: "#171411", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>Back to {booking.store.name}</Link>
      </section>
    </main>
  );
}
