import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, constantTimeEquals, createAdminToken } from "@/lib/admin-pin-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // This endpoint is the single credential check for full platform admin
  // access — brute-forceable without a limit, especially since a "PIN" is
  // typically short/numeric. Same pattern as /api/promote-admin: 5 attempts
  // / 15 minutes / IP is generous for a legitimate admin who mistypes, tight
  // enough to make guessing impractical.
  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`admin-pin:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
    );
  }

  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  if (!process.env.ADMIN_PIN) {
    return NextResponse.json(
      { error: "ADMIN_PIN is not set on the server. Add it in Vercel's environment variables and redeploy." },
      { status: 500 }
    );
  }
  if (!pin || !constantTimeEquals(pin, process.env.ADMIN_PIN)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const token = await createAdminToken();
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours, matches TOKEN_TTL_MS in admin-pin-auth.ts
  });
  return res;
}
