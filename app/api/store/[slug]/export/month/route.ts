import { NextResponse } from "next/server";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { ledgerCsv, MONTH_RE, previousMonth } from "@/lib/chores/month-end";
import { loadMonthLedger } from "@/lib/chores/run";

export const dynamic = "force-dynamic";

/**
 * Month-end sales ledger for an accountant (CSV). Same access rule as the
 * Payments & payouts area: owner/platform staff, or staff granted "payments".
 * GET /api/store/<slug>/export/month?month=2026-10  (defaults to last month)
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "payments");
  if (!access.success) return NextResponse.json({ error: access.error }, { status: 403 });

  const month = new URL(req.url).searchParams.get("month") ?? previousMonth(new Date());
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "month must look like 2026-10" }, { status: 400 });

  const rows = await loadMonthLedger(access.store.id, access.store.timezone, month);
  if (!rows) return NextResponse.json({ error: "Invalid month." }, { status: 400 });

  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  return new NextResponse(ledgerCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeSlug}-sales-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
