// Route: /store/[slug]/travel/[reference]
// Where a traveller lands after paying a tour deposit. Reachable by whoever holds the unguessable payment
// reference (same model as the bank-transfer pay page), so it shows only booking basics, never passports or contacts.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils/format-money";

export const dynamic = "force-dynamic";

export default async function TravelBookingStatus({ params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const payment = await prisma.payment.findFirst({ where: { reference, storeId: store.id, purpose: "TRAVEL_BOOKING" }, include: { travelTrip: { include: { travellers: { select: { id: true } } } } } });
  if (!payment || !payment.travelTrip) notFound();
  const trip = payment.travelTrip;
  const paid = payment.status === "SUCCESSFUL";
  const confirmed = ["CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED"].includes(trip.status);
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>{paid ? (confirmed ? "Booking confirmed" : "Payment received") : payment.status === "PENDING" ? "Payment pending" : "Payment not completed"}</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>{store.name}</p>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginTop: 24, lineHeight: 1.8 }}>
        <div><b>{trip.title}</b> · {trip.destination}</div>
        <div>Booking reference: <b>{trip.reference}</b></div>
        <div>Travellers: {trip.travellers.length}</div>
        <div>{paid ? "Paid" : "Amount due"}: <b>{formatMoney(Number(payment.amount), payment.currency)}</b></div>
      </div>
      <p style={{ marginTop: 20, fontSize: 14, opacity: 0.8 }}>
        {paid ? (confirmed ? "Your place is secured. The agency will contact you with next steps and the balance schedule." : "We have your payment. The agency is confirming availability and will contact you shortly.")
          : payment.status === "PENDING" ? "We are still waiting for confirmation from your bank. This page does not update by itself; refresh in a minute." : "This payment was not completed. If money left your account, contact the agency with your booking reference; otherwise you can start a new booking."}
      </p>
    </main>
  );
}
