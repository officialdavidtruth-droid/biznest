import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { TRAVEL_PLUGIN_KEY } from "@/lib/travel";
import { getPublicTravelPackages } from "@/lib/travel-public";
import { hashPartnerKey } from "@/lib/travel-proposal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Read-only partner feed of bookable departures: GET with `Authorization: Bearer <key>` (key created in Travel → Settings).
 * For resellers, comparison sites and the agency's own website. It lists availability only; partners send customers to
 * the agency's booking page, so payment and seat checks stay in one place. Keys can be revoked at any time.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`travel-partner:${slug}:${ip}`, 60, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } });
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, status: true, currency: true, customDomain: true, customDomainStatus: true, travelSettings: { select: { partnerKeyHash: true } } } });
  const hash = store?.travelSettings?.partnerKeyHash;
  if (!store || store.status !== "ACTIVE" || !hash || hashPartnerKey(key) !== hash) return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  const ent = await getPluginEntitlement(store.id, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return NextResponse.json({ error: "Not available." }, { status: 403 });
  const departures = await getPublicTravelPackages(store.id);
  const base = store.customDomain && store.customDomainStatus === "VERIFIED" ? `https://${store.customDomain}` : null;
  return NextResponse.json({
    agency: store.name,
    departures: departures.map((d) => ({
      packageId: d.id, departureId: d.departureId, name: d.name, destination: d.destination, durationDays: d.durationDays, departureDate: d.departureDate,
      pricePerPerson: d.pricePerPerson, currency: d.currency, seatsLeft: d.seatsLeft, bookableOnline: d.bookable, depositPercent: d.depositPercent, inclusions: d.inclusions,
      bookingUrl: base ? `${base}/#departures` : `https://biznest.space/${store.slug}#departures`,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
