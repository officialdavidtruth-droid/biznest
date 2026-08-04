import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Protected the same way as /api/promote-admin — this leaks user counts,
// so it shouldn't be open to the public.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return NextResponse.json({ success: false, message: "Invalid or missing secret." }, { status: 403 });
  }

  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    const userCount = await prisma.user.count();
    return NextResponse.json({ success: true, result, userCount });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      },
      { status: 500 }
    );
  }
}
