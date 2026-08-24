import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Bootstraps a PLATFORM_ADMIN-role user. Note: this role no longer grants
// access to /supaadmin — that panel is gated by the separate ADMIN_PIN
// (see lib/admin-pin-auth.ts). This role is still used for a few override
// checks elsewhere in the app (e.g. staff being able to view/edit any
// store). Protected by a secret so random visitors can't self-promote.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const secret = searchParams.get("secret");

  // This endpoint grants PLATFORM_ADMIN and is guarded by a single static
  // secret in a URL query string — without rate limiting it's brute-forceable.
  // 5 attempts / hour / IP is generous for legitimate bootstrap use, tight
  // enough to make guessing the secret impractical.
  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`promote-admin:${ip}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ success: false, message: "Too many attempts." }, { status: 429 });
  }

  if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return NextResponse.json({ success: false, message: "Invalid or missing secret." }, { status: 403 });
  }
  if (!email) {
    return NextResponse.json({ success: false, message: "Provide ?email=you@example.com" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { email, customerScopeStoreId: null } });
  if (!user) {
    return NextResponse.json({ success: false, message: `No user found with email ${email}. Register first.` }, { status: 404 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "PLATFORM_ADMIN" } });

  return NextResponse.json({
    success: true,
    message: `${email} is now a PLATFORM_ADMIN. Note: this does NOT grant /supaadmin access — that requires the separate ADMIN_PIN.`,
  });
}