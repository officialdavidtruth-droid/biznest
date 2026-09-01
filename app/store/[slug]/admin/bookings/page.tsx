// Route: /store/[slug]/admin/bookings
import { listBookings, listReservationUnits } from "@/lib/actions/booking";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { ReservationsWorkspace } from "@/components/dashboard/reservations-workspace";
import { StatCard } from "@/components/dashboard/list-toolbar";
import { CalendarDays, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function BookingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { businessType: true } });
  const bookings = await listBookings(slug);

  // Unit-based niches (restaurant tables, salon chairs, etc.) get the richer
  // reservations workspace -- tabs, per-reservation detail panel, and table/
  // unit assignment -- instead of the plain bookings table. Detected by
  // whether this store actually has any ServiceUnit-backed bookings/units,
  // so it degrades gracefully for niches that don't use units at all.
  const hasUnits = bookings.some((b) => b.unitId || b.unit) || (await listReservationUnits(slug)).length > 0;

  if (hasUnits) {
    const terminology = getBusinessTerminology(store?.businessType);
    const units = await listReservationUnits(slug);
    return (
      <div className="bn-admin-page">
        <ReservationsWorkspace
          slug={slug}
          unitLabel={terminology.unitLabel}
          initialUnits={units.map((u) => ({ id: u.id, label: u.label, location: u.location, capacity: u.capacity }))}
          initialReservations={bookings.map((b) => ({
            id: b.id,
            scheduledAt: b.scheduledAt.toString(),
            status: b.status,
            partySize: b.partySize,
            specialRequests: b.specialRequests,
            guestName: b.buyer?.name ?? b.guestName ?? "Walk-in guest",
            guestPhone: b.buyer?.phone ?? b.guestPhone ?? "",
            unitId: b.unitId,
            unitLabel: b.unit?.label ?? null,
          }))}
        />
      </div>
    );
  }

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const completedCount = bookings.filter((b) => b.status === "COMPLETED").length;

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage appointments and reservations</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} tone="purple" label="Total Bookings" value={bookings.length} note="All time" />
        <StatCard icon={Clock3} tone="orange" label="Pending" value={pendingCount} note="Awaiting confirmation" />
        <StatCard icon={CheckCircle2} tone="green" label="Confirmed" value={confirmedCount} note="Upcoming" />
        <StatCard icon={XCircle} tone="blue" label="Completed" value={completedCount} note="Finished bookings" />
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-base font-bold">Bookings</h2><p className="mt-1 text-xs text-muted-foreground">Search, filter and manage every booking</p></div>
        <BookingsTable
          storeSlug={slug}
          bookings={bookings.map((b) => {
            const name = b.buyer?.name ?? b.guestName ?? "Walk-in guest";
            const email = b.buyer?.email ?? b.guestEmail ?? "";
            const phone = b.buyer?.phone ?? b.guestPhone ?? "";
            const q = new URLSearchParams();
            if (b.buyerId) q.set("u", b.buyerId);
            if (email) q.set("e", email);
            if (phone) q.set("p", phone);
            if (!b.buyerId && !email && !phone) q.set("n", name);
            return {
              id: b.id,
              scheduledAt: b.scheduledAt.toString(),
              serviceName: b.service.name,
              customerName: name,
              status: b.status,
              query: q.toString(),
            };
          })}
        />
      </section>
    </div>
  );
}
