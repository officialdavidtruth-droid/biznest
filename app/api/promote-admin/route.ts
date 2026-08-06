import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Bootstraps a PLATFORM_ADMIN-role user. Note: this role no longer grants
// access to /supaadmin — that panel is gated by the separate ADMIN_PIN
// (see lib/admin-pin-auth.ts). This role is still used for a few override
// checks elsewhere in the app (e.g. staff being able to view/edit any
// store). Protected by a secret so random visitors can't self-promote.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const secret = searchParams.get("secret");

  if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return NextResponse.json({ success: false, message: "Invalid or missing secret." }, { status: 403 });
  }
  if (!email) {
    return NextResponse.json({ success: false, message: "Provide ?email=you@example.com" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, message: `No user found with email ${email}. Register first.` }, { status: 404 });
  }

  await prisma.user.update({ where: { email }, data: { role: "PLATFORM_ADMIN" } });

  return NextResponse.json({
    success: true,
    message: `${email} is now a PLATFORM_ADMIN. Note: this does NOT grant /supaadmin access — that requires the separate ADMIN_PIN.`,
  });
}
