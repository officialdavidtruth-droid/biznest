import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listBookings } from "@/lib/actions/booking";

const BOOKING_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const [services, bookings] = await Promise.all([
    prisma.service.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" } }),
    listBookings(slug),
  ]);

  const upcoming = bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "COMPLETED");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Services</h1>
        <Link href={`/store/${slug}/admin/services/new`} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          + Add service
        </Link>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Service</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Booking</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.currency} {Number(s.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.isBookable ? `${s.durationMins ?? "—"} min slots` : "Not bookable"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {s.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/store/${slug}/admin/services/${s.id}/edit`} className="text-xs font-medium text-primary hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No services yet — add your first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Upcoming bookings ({upcoming.length})</h2>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Service</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {upcoming.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3">{new Date(b.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3">{b.service.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.buyer.name ?? b.buyer.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${BOOKING_STYLES[b.status]}`}>{b.status}</span>
                </td>
              </tr>
            ))}
            {upcoming.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No upcoming bookings.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
