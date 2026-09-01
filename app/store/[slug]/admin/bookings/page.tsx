// Route: /store/[slug]/admin/bookings
import { listBookings } from "@/lib/actions/booking";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { StatCard } from "@/components/dashboard/list-toolbar";
import { CalendarDays, Clock3, CheckCircle2, XCircle } from "lucide-react";

export default async function BookingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bookings = await listBookings(slug);

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
