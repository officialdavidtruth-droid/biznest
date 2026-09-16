import { isHotelStore } from "@/lib/storefront-routing"; import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { HotelConfirmation } from "@/components/storefront/theluso-hotel";
import { BookingPaymentRetry } from "@/components/storefront/booking-payment-retry";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; bookingId: string }> }): Promise<Metadata> {
  const { slug, bookingId } = await params;
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, store: { slug } }, select: { service: { select: { name: true } }, store: { select: { name: true } }, } });
  return booking ? { title: `Booking — ${booking.store.name}` } : { title: "Booking" };
}

export default async function BookingConfirmationPage({ params, searchParams }: { params: Promise<{ slug: string; bookingId: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, bookingId } = await params;
  const { payment } = await searchParams;
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, store: { slug } }, include: { service: true, store: { include: { template: true, business: true } }, buyer: { select: { name: true, email: true } } } });
  if (!booking || booking.store.status !== "ACTIVE") notFound();
  const isHotel = isHotelStore({ businessCategory: booking.store.business?.category, templateName: booking.store.template?.name });
  if (isHotel) return <HotelConfirmation store={booking.store} slug={slug} booking={booking} />;
  const paid = booking.paymentStatus === "PAID";
  return <main style={{ minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#faf9f7" }}><section style={{maxWidth:620,width:"100%",background:"#fff",padding:40,border:"1px solid #e8e4de",borderRadius:18}}><h1>{paid?"Booking confirmed":payment==="failed"?"Payment not completed":"Booking received"}</h1><p>{booking.service.name}</p>{!paid&&payment==="failed"&&<BookingPaymentRetry storeSlug={slug} bookingId={booking.id} requiresGuestEmail={!booking.buyerId} defaultEmail={booking.guestEmail||""}/>}<Link href={`/store/${slug}`}>Back to store</Link></section></main>;
}