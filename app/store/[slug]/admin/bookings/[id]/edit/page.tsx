import { getCanonicalBusinessType } from "@/lib/business-identity";
// Route: /store/[slug]/admin/bookings/[id]/edit
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getReservation, listReservationUnits } from "@/lib/actions/booking";
import { ReservationEditForm } from "@/components/dashboard/reservation-edit-form";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function EditReservationPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  const [result, units, store] = await Promise.all([
    getReservation(slug, id),
    listReservationUnits(slug),
    prisma.store.findUnique({ where: { slug }, select: { businessType: true, business: { select: { category: true } }, timezone: true } }),
  ]);
  if (!result) notFound();

  const { booking: b, totalReservations } = result;
  const terminology = getBusinessTerminology(getCanonicalBusinessType({ businessCategory: store?.business?.category, storeBusinessType: store?.businessType }));
  const addons = Array.isArray(b.addons)
    ? (b.addons as unknown[]).flatMap((a) => {
        const o = a as { label?: unknown; price?: unknown };
        return typeof o?.label === "string" ? [{ label: o.label, price: Number(o.price) || 0 }] : [];
      })
    : [];

  return (
    <div className="bn-admin-page">
      <ReservationEditForm
        slug={slug}
        unitLabel={terminology.unitLabel}
        customerLabel={terminology.customer}
        units={units.map((u) => ({ id: u.id, label: u.label, location: u.location, capacity: u.capacity }))}
        totalReservations={totalReservations}
        timezone={store?.timezone || "Africa/Lagos"}
        reservation={{
          id: b.id,
          scheduledAt: b.scheduledAt.toISOString(),
          durationMins: b.durationMins,
          status: b.status,
          paymentStatus: b.paymentStatus as "UNPAID" | "PENDING" | "PAID" | "REFUNDED",
          partySize: b.partySize,
          specialRequests: b.specialRequests,
          notes: b.notes,
          source: b.source,
          reservationType: b.reservationType,
          addons,
          reminderOffsetMinutes: b.reminderOffsetMinutes,
          sendConfirmation: b.sendConfirmation,
          guestName: b.buyer?.name ?? b.guestName ?? "Walk-in guest",
          guestPhone: b.buyer?.phone ?? b.guestPhone ?? "",
          guestEmail: b.buyer?.email ?? b.guestEmail ?? "",
          memberSince: (b.buyer?.createdAt ?? b.createdAt).toISOString(),
          unitId: b.unitId,
          unitLabel: b.unit?.label ?? null,
          unitLocation: b.unit?.location ?? null,
          createdAt: b.createdAt.toISOString(),
          createdBy: b.staff?.invitedName ?? "Staff",
        }}
      />
    </div>
  );
}
