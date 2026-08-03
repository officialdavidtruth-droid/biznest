import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// TEMPORARY — for diagnosing the production database connection.
// Delete this file (or at least stop deploying it) once things are working;
// it's not something you want reachable indefinitely.
export async function GET() {
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
