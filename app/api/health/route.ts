import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight public health endpoint. It deliberately exposes no secrets or
 * infrastructure details. Use /api/health for liveness and /api/health/ready
 * for database readiness.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "biznest",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
