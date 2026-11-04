import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { revokeAdminSession } from "@/lib/admin-session";

export async function POST() {
  // Revoke server-side too, so a copied cookie stops working immediately rather than after 12 hours.
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  await revokeAdminSession(token).catch(() => {});
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
