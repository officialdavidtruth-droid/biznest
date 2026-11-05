import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { TRAVEL_BUSINESS_TYPE, TRAVEL_PLUGIN_KEY } from "@/lib/travel";
import { TRAVEL_DOC_KINDS, buildTravelDocumentPdf, type TravelDocKind, type TravelDocInput } from "@/lib/travel-documents";
import { readFlight } from "@/lib/travel-flight";

/**
 * Client-facing PDF for a trip: ?type=quote | invoice | itinerary | receipt (default quote). A receipt also needs &payment=<TravelPayment id>.
 * Staff-only (same access rules as the travel workspace). Rendered on demand, nothing is stored.
 * Never includes cost prices, margin, supplier names, passport numbers or internal notes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; tripId: string }> }) {
  const { slug, tripId } = await params;
  const a = await assertStorePermission(slug, `plugin:${TRAVEL_PLUGIN_KEY}`);
  if (!a.success) return NextResponse.json({ error: a.error }, { status: a.error === "You must be signed in." ? 401 : 403 });

  const ent = await getPluginEntitlement(a.store.id, TRAVEL_PLUGIN_KEY);
  if (!ent.allowed || !ent.installed) return NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 });
  const type = getCanonicalBusinessType({ businessCategory: a.store.business?.category, storeBusinessType: a.store.businessType });
  if (type !== TRAVEL_BUSINESS_TYPE) return NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 });

  const requested = new URL(req.url).searchParams.get("type") ?? "quote";
  if (!(TRAVEL_DOC_KINDS as readonly string[]).includes(requested)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  const kind = requested as TravelDocKind;

  // storeId in the where clause is the tenant-isolation check: a trip id from another store returns 404.
  const trip = await prisma.travelTrip.findFirst({
    where: { id: tripId, storeId: a.store.id },
    include: {
      client: { select: { fullName: true, email: true, phone: true } },
      travellers: { orderBy: [{ isLead: "desc" }, { fullName: "asc" }], select: { fullName: true, isLead: true } },
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      itineraryDays: { orderBy: { dayNumber: "asc" }, select: { dayNumber: true, title: true, description: true } },
    },
  });
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  let receiptPayment: TravelDocInput["receiptPayment"];
  let receiptId = "";
  if (kind === "receipt") {
    receiptId = new URL(req.url).searchParams.get("payment") ?? "";
    const p = trip.payments.find((x) => x.id === receiptId);
    if (!p) return NextResponse.json({ error: "Payment not found on this trip." }, { status: 404 });
    if (p.status !== "RECEIVED" && p.status !== "REFUNDED") return NextResponse.json({ error: "A receipt can only be issued for money that was received." }, { status: 400 });
    receiptPayment = { number: `RCT-${p.id.slice(-6).toUpperCase()}`, amount: Number(p.amount), method: p.method, paidAt: p.paidAt, reference: p.reference, refundedAmount: Number(p.refundedAmount) };
  }

  const bytes = await buildTravelDocumentPdf({
    kind,
    store: { name: a.store.name, contactEmail: a.store.contactEmail, contactPhone: a.store.contactPhone, whatsappNumber: a.store.whatsappNumber },
    trip: { reference: trip.reference, title: trip.title, destination: trip.destination, departDate: trip.departDate, returnDate: trip.returnDate, currency: trip.currency, totalPrice: Number(trip.totalPrice) },
    client: trip.client,
    travellers: trip.travellers,
    items: trip.items.map((i) => ({ kind: i.kind, description: i.description, startDate: i.startDate, endDate: i.endDate, confirmationRef: i.confirmationRef, status: i.status, sellPrice: Number(i.sellPrice), flight: i.kind === "FLIGHT" ? readFlight(i.flightDetails) : null })),
    payments: trip.payments.map((p) => ({ amount: Number(p.amount), status: p.status, method: p.method, paidAt: p.paidAt, dueDate: p.dueDate, reference: p.reference, refundedAmount: Number(p.refundedAmount) })),
    itineraryDays: trip.itineraryDays,
    receiptPayment,
    locale: a.store.locale,
  });

  const file = `${kind}-${trip.reference}${receiptId ? `-${receiptId.slice(-6)}` : ""}`.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
