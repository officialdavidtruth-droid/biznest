import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { performPlatformUnsubscribe } from "@/lib/email/perform-platform-unsubscribe";

/** One-click unsubscribe (RFC 8058) for BizNest's own reminder and promotional emails. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`unsubscribe-platform:${ip}`, 20, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  await performPlatformUnsubscribe(req.nextUrl.searchParams.get("token"));
  return NextResponse.json({ ok: true });
}
