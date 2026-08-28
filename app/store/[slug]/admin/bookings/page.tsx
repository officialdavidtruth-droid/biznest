// Route: /store/[slug]/admin/bookings
import Link from "next/link";
import { listBookings } from "@/lib/actions/booking";
import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge";
import { BookingStatusFilter } from "@/components/dashboard/booking-status-filter";

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;
  const allBookings = await listBookings(slug);

  const bookings =
    status && status !== "ALL"
      ? allBookings.filter((b) => b.status === status)
      : allBookings;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">{bookings.length} booking{bookings.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">
                <BookingStatusFilter />
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const name = b.buyer?.name ?? b.guestName ?? "Walk-in guest";
              const email = b.buyer?.email ?? b.guestEmail ?? "";
              const phone = b.buyer?.phone ?? b.guestPhone ?? "";
              const q = new URLSearchParams();
              if (b.buyerId) q.set("u", b.buyerId);
              if (email) q.set("e", email);
              if (phone) q.set("p", phone);
              if (!b.buyerId && !email && !phone) q.set("n", name);

              return (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{new Date(b.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-3">{b.service.name}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/admin/customers?${q.toString()}`}
                      className="text-muted-foreground hover:text-primary hover:underline"
                    >
                      {name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={b.status} />
                  </td>
                </tr>
              );
            })}
            {bookings.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No bookings match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
      }
