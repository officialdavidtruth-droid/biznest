import { NextRequest, NextResponse } from "next/server";
import { createStoreCustomerSession } from "@/lib/store-customer-auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { verifyToken } from "@/lib/store-google";

/** Runs on the store's own host so the customer cookie is set where the shopper actually is. */
export async function GET(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const origin = `https://${host}`;
  const data = verifyToken<{ userId: string; storeId: string; returnTo: string; origin: string }>("store-google-handoff", req.nextUrl.searchParams.get("t"));
  if (!data || data.origin !== origin) return NextResponse.redirect(new URL("/login?error=GoogleFailed", origin));

  try {
    await createStoreCustomerSession(data.userId, data.storeId);
  } catch {
    return NextResponse.redirect(new URL("/login?error=GoogleFailed", origin));
  }
  return NextResponse.redirect(new URL(safeRedirectPath(data.returnTo, "/"), origin));
}

export const dynamic = "force-dynamic";
