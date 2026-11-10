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
      dbRegion: (process.env.DATABASE_URL ?? "").match(/aws-\d+-([a-z0-9-]+)\.pooler/)?.[1] ?? "unknown", // TEMP diagnostic
      fnRegion: process.env.VERCEL_REGION,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: "biznest", database: "unavailable", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
