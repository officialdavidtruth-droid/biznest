"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

export type BookingCodeMatch = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  serviceName: string;
  unitLabel: string | null;
  scheduledAt: string;
  checkIn: string | null;
  checkOut: string | null;
  partySize: number | null;
  amount: number | null;
  currency: string;
  /** True when the guest used a booking ID from before 7-character codes existed. */
  legacy: boolean;
};

const SHORT_CODE = /^[A-Za-z0-9]{7}$/;
// The Veloura-style hotel confirmation page used to show "TLH-" + the last 8
// characters of the booking ID. Guests who saved that still get found.
const LEGACY_TLH = /^TLH-([A-Za-z0-9]{8})$/i;

/**
 * Staff enter the code a guest was sent after paying. New bookings carry a
 * 7-character referenceCode; bookings made before that keep working with the
 * original booking ID (or the old TLH- form), so nobody who already booked is
 * locked out. Always scoped to this store.
 */
export async function findBookingByCode(slug: string, rawCode: string): Promise<ActionResult<BookingCodeMatch>> {
  const access = await assertStorePermission(slug, "products");
  if (!access.success) return { success: false, error: access.error };

  const input = rawCode.trim();
  if (!input) return { success: false, error: "Enter the booking code." };
  if (input.length > 40) return { success: false, error: "That doesn't look like a booking code." };

  // Typing codes by hand invites guessing; a person checking guests in never gets near this.
  const rate = await checkRateLimit(`booking-code-lookup:${access.store.id}`, 60, 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many lookups. Please wait a moment and try again." };

  const select = {
    id: true,
    referenceCode: true,
    status: true,
    paymentStatus: true,
    guestName: true,
    guestPhone: true,
    guestEmail: true,
    scheduledAt: true,
    checkIn: true,
    checkOut: true,
    partySize: true,
    paymentAmount: true,
    paymentCurrency: true,
    service: { select: { name: true, price: true, currency: true } },
    unit: { select: { label: true } },
    buyer: { select: { name: true, email: true, phone: true } },
  } as const;

  let booking = null;
  let legacy = false;

  if (SHORT_CODE.test(input)) {
    booking = await prisma.booking.findFirst({
      where: { storeId: access.store.id, referenceCode: input.toUpperCase() },
      select,
    });
  }

  if (!booking) {
    const tlh = input.match(LEGACY_TLH);
    if (tlh) {
      const matches = await prisma.booking.findMany({
        where: { storeId: access.store.id, referenceCode: null, id: { endsWith: tlh[1].toLowerCase() } },
        select,
        take: 2,
      });
      if (matches.length === 1) {
        booking = matches[0];
        legacy = true;
      }
    } else {
      // Original booking ID. Only bookings created before codes existed may be
      // looked up this way, so a new booking can't be found by its long ID
      // guessed or leaked from a URL.
      booking = await prisma.booking.findFirst({
        where: { storeId: access.store.id, id: input, referenceCode: null },
        select,
      });
      legacy = !!booking;
    }
  }

  if (!booking) return { success: false, error: "No booking found for that code in this store." };

  return {
    success: true,
    data: {
      id: booking.id,
      code: booking.referenceCode || booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      guestName: booking.buyer?.name ?? booking.guestName ?? "Guest",
      guestPhone: booking.buyer?.phone ?? booking.guestPhone ?? "",
      guestEmail: booking.buyer?.email ?? booking.guestEmail ?? "",
      serviceName: booking.service.name,
      unitLabel: booking.unit?.label ?? null,
      scheduledAt: booking.scheduledAt.toISOString(),
      checkIn: booking.checkIn?.toISOString() ?? null,
      checkOut: booking.checkOut?.toISOString() ?? null,
      partySize: booking.partySize,
      amount: booking.paymentAmount != null ? Number(booking.paymentAmount) : Number(booking.service.price),
      currency: booking.paymentCurrency || booking.service.currency,
      legacy,
    },
  };
}
