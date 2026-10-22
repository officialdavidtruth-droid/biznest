import { NextResponse } from "next/server";
import { buildExportFeedForToken } from "@/lib/channels/sync";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Secret per-connection iCal feed that an OTA imports. The unguessable token
 * is the credential (the standard model for iCal feeds); the feed contains
 * dates only, never guest names or contact details.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{48}$/.test(clean)) return new NextResponse("Not found", { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = await checkRateLimit(`ical:${ip}`, 120, 60_000);
  if (!limited.allowed) return new NextResponse("Too many requests", { status: 429 });

  const body = await buildExportFeedForToken(clean);
  if (!body) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "content-disposition": 'inline; filename="calendar.ics"' },
  });
}
