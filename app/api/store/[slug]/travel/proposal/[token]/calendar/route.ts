import { NextResponse } from "next/server";
import { loadProposal } from "@/lib/travel-proposal";
import { buildIcs, type IcsEvent } from "@/lib/travel-growth";

export const dynamic = "force-dynamic";

/** "Add to calendar" file for one trip, for whoever holds the proposal link: the trip itself plus dated services (flights, hotels). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const v = await loadProposal(slug, token);
  if (!v) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const events: IcsEvent[] = [];
  if (v.trip.departDate) {
    events.push({
      uid: `trip-${v.trip.id}@biznest.space`, start: new Date(v.trip.departDate), end: v.trip.returnDate ? new Date(v.trip.returnDate) : null,
      summary: `${v.trip.title} (${v.trip.destination})`, description: `Booking reference ${v.trip.reference} · ${v.store.name}`, location: v.trip.destination,
    });
  }
  for (const [i, it] of v.items.entries()) {
    if (!it.startDate || it.status === "CANCELLED") continue;
    events.push({ uid: `item-${v.trip.id}-${i}@biznest.space`, start: new Date(it.startDate), end: it.endDate ? new Date(it.endDate) : null, summary: it.description, description: `${v.trip.title} · ${v.trip.reference}`, location: v.trip.destination });
  }
  return new NextResponse(buildIcs(`${v.trip.title}`, events), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${v.trip.reference}.ics"`, "Cache-Control": "private, no-store" } });
}
