import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Bootstraps the first PLATFORM_ADMIN. Protected by a secret so random
// visitors can't self-promote. Set ADMIN_BOOTSTRAP_SECRET in Vercel env
// vars, visit this once with the matching secret, then consider removing
// it (or at least rotating the secret) once you have your admin account.
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
    message: `${email} is now a PLATFORM_ADMIN. Visit https://biznest.space/supaadmin.`,
  });
}
