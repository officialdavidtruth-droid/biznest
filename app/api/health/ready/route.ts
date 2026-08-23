import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Database readiness probe. Returns only coarse status information. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "biznest",
      database: "ready",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: "biznest", database: "unavailable", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
