import "server-only";

import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail, type BookingStoreBranding } from "@/lib/email/send";

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

/**
 * Builds the store-branding payload (logo/name/color) that the booking
 * confirmation email renders in place of the hardcoded BizNest identity.
 */
function toStoreBranding(store: { name: string; slug: string; logoUrl: string | null; themeColors: unknown; contactEmail: string | null; contactPhone: string | null }): BookingStoreBranding {
  const theme = (store.themeColors ?? null) as { primary?: string } | null;
  return {
    name: store.name,
    slug: store.slug,
    logoUrl: store.logoUrl,
    primaryColor: theme?.primary ?? null,
    contactEmail: store.contactEmail,
    contactPhone: store.contactPhone,
  };
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Marks a booking CONFIRMED (from PENDING) once payment succeeds, and sends
 * the full branded confirmation email. Centralized so all three
 * payment-settlement paths (gateway checkout, wallet payment, wallet QR
 * redemption) stay in sync instead of each hand-rolling status + email logic.
 */
export async function confirmPaidBooking(
  bookingId: string,
  paymentReference: string,
  amount: number
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      store: true,
      staff: { select: { invitedName: true, position: true, user: { select: { name: true } } } },
      buyer: { select: { email: true, name: true } },
    },
  });
  if (!booking) return;
  // A delayed gateway callback can arrive after staff cancellation. Never
  // turn that cancelled reservation into a customer-facing confirmation.
  if (booking.status === "CANCELLED") return;

  // Sync status -> CONFIRMED automatically now that payment is PAID, unless
  // the booking was already moved past PENDING (e.g. cancelled) by staff.
  if (booking.status === "PENDING") {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
  }

  const recipientEmail = booking.guestEmail ?? booking.buyer?.email ?? null;
  if (!recipientEmail) return;

  const isStay = Boolean(booking.checkIn && booking.checkOut);
  const staffName = booking.staff?.user?.name || booking.staff?.invitedName || booking.staff?.position || null;

  await sendBookingConfirmationEmail(recipientEmail, toStoreBranding(booking.store), {
    bookingId: booking.id,
    status: booking.status === "PENDING" ? "CONFIRMED" : (booking.status as "CONFIRMED"),
    serviceName: booking.service.name,
    price: amount,
    currency: booking.paymentCurrency,
    date: isStay ? undefined : DATE_FMT.format(booking.scheduledAt),
    time: isStay ? undefined : TIME_FMT.format(booking.scheduledAt),
    checkIn: isStay ? DATE_FMT.format(booking.checkIn!) : undefined,
    checkOut: isStay ? DATE_FMT.format(booking.checkOut!) : undefined,
    staffName,
    notes: booking.notes,
    paymentReference,
    recipientName: booking.guestName ?? booking.buyer?.name ?? null,
  });
}
