import { NextResponse } from "next/server";
import {
  getStoreCustomerSession,
  signOutStoreCustomer,
} from "@/lib/store-customer-auth";

export const runtime = "nodejs";

// This route intentionally has no POST handler: it never logs anyone in (that
// only happens via loginStoreCustomer() in lib/actions/store-customer.ts) and
// logout is DELETE-only, which cross-site requests can't send without a CORS
// preflight.
//
// GET is used by AccountLink (storefront header) to check whether the current
// visitor has a valid store-customer session, so it knows whether to
// render "My account" or "Sign in". Read-only — must not mutate the
// session either way.
export async function GET() {
  const session = await getStoreCustomerSession();

  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    customer: {
      userId: session.user.id,
      storeId: session.user.customerStoreId,
      name: session.user.name,
      email: session.user.email,
    },
  });
}

export async function DELETE() {
  try {
    await signOutStoreCustomer();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Store customer logout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to sign out.",
      },
      { status: 500 }
    );
  }
}
