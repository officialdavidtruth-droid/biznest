import { NextResponse } from "next/server";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { buildCustomerExport } from "@/lib/customer-privacy";
import { checkRateLimit } from "@/lib/rate-limit";
import { withObservability } from "@/lib/observability/api-wrapper";

export const runtime = "nodejs";

/** A signed-in store customer downloads a copy of the data this store holds about them. */
export const GET = withObservability("customer-data-export", async (_req: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const membership = await requireStoreCustomer(slug);
  if (!membership) return NextResponse.json({ error: "Sign in to download your data." }, { status: 401 });
  const rate = await checkRateLimit(`customer-export:${membership.userId}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many downloads. Please try again later." }, { status: 429 });
  const data = await buildCustomerExport(membership.userId, membership.storeId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="my-data-${slug}.json"`, "Cache-Control": "no-store" },
  });
});
