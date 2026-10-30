import { NextResponse } from "next/server";
import { withObservability } from "@/lib/observability/api-wrapper";
import { getRate } from "@/lib/fx/rates";

// Display-only estimate used by <ApproxPrice>. One upstream fetch (USD table) is
// cached for 12h, so varying from/to never multiplies provider calls.
export const GET = withObservability("fx-rate", async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "").toUpperCase();
  const to = (searchParams.get("to") ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: "from and to must be 3-letter currency codes" }, { status: 400 });
  }
  const result = await getRate(from, to);
  if (!result) return NextResponse.json({ error: "Rate unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=43200" } });
});
