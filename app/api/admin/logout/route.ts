import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
