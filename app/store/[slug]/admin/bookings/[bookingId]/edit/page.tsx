// Route: /store/[slug]/admin/bookings/[bookingId]/edit
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getReservation, listReservationUnits } from "@/lib/actions/booking";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { ReservationEditForm } from "@/components/dashboard/reservation-edit-form";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;

  const [result, units, store] = await Promise.all([
    getReservation(slug, bookingId),
    listReservationUnits(slug),
    prisma.store.findUnique({ where: { slug }, select: { business: { select: { category: true } } } }),
  ]);

  if (!result) notFound();

  const terminology = getBusinessTerminology(store?.business.category);
  const { booking, totalReservations } = result;

  return (
    <div className="bn-admin-page">
      <ReservationEditForm
        slug={slug}
        unitLabel={terminology.unitLabel}
        customerLabel={terminology.customer}
        units={units.map((u) => ({ id: u.id, label: u.label, location: u.location, capacity: u.capacity }))}
        totalReservations={totalReservations}
        reservation={{
          id: booking.id,
          scheduledAt: booking.scheduledAt.toISOString(),
          durationMins: booking.durationMins,
          status: booking.status,
          partySize: booking.partySize,
          specialRequests: booking.specialRequests,
          notes: booking.notes,
          source: booking.source,
          reservationType: booking.reservationType,
          addons: (booking.addons as { label: string; price: number }[] | null) ?? [],
          reminderOffsetMinutes: booking.reminderOffsetMinutes,
          sendConfirmation: booking.sendConfirmation,
          guestName: booking.buyer?.name ?? booking.guestName ?? "Walk-in guest",
          guestPhone: booking.buyer?.phone ?? booking.guestPhone ?? "",
          guestEmail: booking.buyer?.email ?? booking.guestEmail ?? "",
          memberSince: (booking.buyer?.createdAt ?? booking.createdAt).toISOString(),
          unitId: booking.unitId,
          unitLabel: booking.unit?.label ?? null,
          unitLocation: booking.unit?.location ?? null,
          createdAt: booking.createdAt.toISOString(),
          createdBy: booking.staff?.invitedName ?? booking.staff?.position ?? "Store Admin",
        }}
      />
    </div>
  );
}
