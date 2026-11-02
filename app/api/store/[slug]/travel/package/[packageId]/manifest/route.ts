import { NextResponse } from "next/server";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { TRAVEL_BUSINESS_TYPE, TRAVEL_PLUGIN_KEY, roomingGroups } from "@/lib/travel";
import { loadDeparture } from "@/lib/travel-manifest";
import { toCsv } from "@/lib/utils/csv";

const d = (v: string | null) => (v ? v.slice(0, 10) : "");

/**
 * Departure lists as CSV for a group package: ?type=manifest (airline / operator) or ?type=rooming (hotel).
 * Staff-only, same checks as the travel workspace. Passport numbers are included on purpose: the manifest exists to be sent to carriers.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; packageId: string }> }) {
  const { slug, packageId } = await params;
  const a = await assertStorePermission(slug, `plugin:${TRAVEL_PLUGIN_KEY}`);
  if (!a.success) return NextResponse.json({ error: a.error }, { status: a.error === "You must be signed in." ? 401 : 403 });
  const ent = await getPluginEntitlement(a.store.id, TRAVEL_PLUGIN_KEY);
  if (!ent.allowed || !ent.installed) return NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 });
  const type = getCanonicalBusinessType({ businessCategory: a.store.business?.category, storeBusinessType: a.store.businessType });
  if (type !== TRAVEL_BUSINESS_TYPE) return NextResponse.json({ error: "BizNest Travel is not available for this store." }, { status: 403 });

  const kind = new URL(req.url).searchParams.get("type") === "rooming" ? "rooming" : "manifest";
  const dep = await loadDeparture(a.store.id, packageId);
  if (!dep) return NextResponse.json({ error: "Package not found." }, { status: 404 });

  let csv: string;
  if (kind === "manifest") {
    csv = toCsv(
      ["No", "Full name", "Gender", "Date of birth", "Nationality", "Passport no", "Passport expiry", "Booking", "Booked by", "Contact phone", "Room", "Room type", "Special requests"],
      dep.rows.map((r, i) => [i + 1, r.fullName, r.gender, d(r.dateOfBirth), r.nationality, r.passportNo, d(r.passportExpiry), r.tripReference, r.contactName, r.contactPhone, r.roomLabel, r.roomType, r.requests]),
    );
  } else {
    const { rooms, unassigned } = roomingGroups(dep.rows);
    const lines = rooms.flatMap((room) => room.members.map((m) => [room.label, room.type, m.fullName, m.gender, m.requests, room.problems.join("; ")]));
    csv = toCsv(["Room", "Room type", "Guest", "Gender", "Special requests", "Check"], [...lines, ...unassigned.map((m) => ["UNASSIGNED", m.roomType, m.fullName, m.gender, m.requests, "No room yet"])]);
  }
  const file = `${kind}-${dep.pkg.name}`.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"`, "Cache-Control": "private, no-store" } });
}
