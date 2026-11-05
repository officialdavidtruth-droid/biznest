import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { TRAVEL_PLUGIN_KEY } from "@/lib/travel";
import { buildIcs, type IcsEvent } from "@/lib/travel-growth";

export const dynamic = "force-dynamic";

/**
 * Public calendar feed of the agency's open departures (the same ones its storefront already lists), to subscribe to
 * from Google, Apple or Outlook calendar. Names, destinations and dates only: no prices, seats or travellers.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, status: true } });
  if (!store || store.status !== "ACTIVE") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ent = await getPluginEntitlement(store.id, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const now = new Date();
  const pkgs = await prisma.travelPackage.findMany({
    where: { storeId: store.id, isActive: true },
    select: { id: true, name: true, destination: true, durationDays: true, departureDate: true, departures: { where: { isActive: true, departureDate: { gte: now } }, select: { id: true, departureDate: true } } },
    take: 100,
  });
  const events: IcsEvent[] = [];
  for (const p of pkgs) {
    const slots = [...(p.departureDate && p.departureDate >= now ? [{ id: "main", date: p.departureDate }] : []), ...p.departures.map((d) => ({ id: d.id, date: d.departureDate }))];
    for (const s of slots) {
      events.push({ uid: `dep-${p.id}-${s.id}@biznest.space`, start: s.date, end: new Date(s.date.getTime() + (p.durationDays - 1) * 86_400_000), summary: `${p.name} (${p.destination})`, location: p.destination });
    }
  }
  return new NextResponse(buildIcs(`${store.name} departures`, events, now), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="${slug}-departures.ics"`, "Cache-Control": "public, max-age=900" } });
}
