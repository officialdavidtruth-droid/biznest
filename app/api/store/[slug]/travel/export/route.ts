import { NextResponse } from "next/server";
import { travelRouteAccess } from "@/lib/travel-access";
import { buildTravelReports, profitCsv, receivablesCsv, paymentsCsv } from "@/lib/travel-reports";

export const dynamic = "force-dynamic";

/**
 * CSV downloads for the agency's accountant: ?kind=profit (profit per trip) | receivables (instalments owed, with ageing)
 * | payments (every payment received). Staff-only, same access rules as the travel workspace. Opens in Excel, Google
 * Sheets, Xero and QuickBooks imports. Cells that could be read as formulas are escaped.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await travelRouteAccess(slug);
  if (!a.ok) return a.res;
  const kind = new URL(req.url).searchParams.get("kind") ?? "profit";
  let body: string;
  if (kind === "payments") body = await paymentsCsv(a.store.id);
  else if (kind === "profit" || kind === "receivables") {
    const reports = await buildTravelReports(a.store.id);
    body = kind === "profit" ? profitCsv(reports) : receivablesCsv(reports);
  } else return NextResponse.json({ error: "Unknown export." }, { status: 400 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${body}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="travel-${kind}-${stamp}.csv"`, "Cache-Control": "no-store" } });
}
