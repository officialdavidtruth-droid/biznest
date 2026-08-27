// Route: /store/[slug]/admin/calendar
import { getCalendarData } from "@/lib/actions/service-unit";
import { notFound } from "next/navigation";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug } = await params;
  const { from } = await searchParams;

  const rangeStartDate = from ? new Date(`${from}T00:00:00`) : new Date();
  if (Number.isNaN(rangeStartDate.getTime())) notFound();
  rangeStartDate.setHours(0, 0, 0, 0);

  const rangeEndDate = new Date(rangeStartDate);
  rangeEndDate.setDate(rangeEndDate.getDate() + 13); // 14-day window

  const data = await getCalendarData(slug, toISODate(rangeStartDate), toISODate(rangeEndDate));
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bookings across every unit-based service — room categories, rental fleets, and anything else booked by date range.
        </p>
      </div>

      {data.services.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
          No unit-based services yet. On a service's "Add service" form, choose "Multiple units" and set a unit count to see it here.
        </div>
      ) : (
        <CalendarGrid
          slug={slug}
          services={data.services}
          rangeStart={toISODate(rangeStartDate)}
          rangeEnd={toISODate(rangeEndDate)}
        />
      )}
    </div>
  );
}

