import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { HOOK_TOKEN_RE, MAX_INBOUND_BYTES, parseInboundEvents, verifySignature } from "@/lib/channels/live";
import { syncConnection } from "@/lib/channels/sync";
import { applyInboundEvents } from "@/lib/channels/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Live inbound link for one channel connection. The token in the path is the credential for a "ping":
 * an empty POST makes BizNest re-read that channel's calendar right now (rate limited).
 * A POST with JSON events (booking.created / booking.updated / booking.cancelled) must also be signed:
 *   x-biznest-timestamp: <unix seconds>
 *   x-biznest-signature: sha256=HMAC_SHA256(secret, "<timestamp>.<raw body>")
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!HOOK_TOKEN_RE.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limited = await checkRateLimit(`chhook:${token}`, 120, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const conn = await prisma.channelConnection.findUnique({
    where: { hookToken: token },
    select: { id: true, storeId: true, roomId: true, provider: true, label: true, isActive: true, importUrl: true, liveSecret: true, lastSyncAt: true },
  });
  if (!conn || !conn.isActive || !conn.liveSecret) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_INBOUND_BYTES) return NextResponse.json({ error: "Body too large" }, { status: 413 });

  // Ping: no body -> re-read the channel calendar.
  if (!raw.trim()) {
    if (!conn.importUrl) return NextResponse.json({ ok: true, note: "No calendar link to read." });
    if (conn.lastSyncAt && Date.now() - conn.lastSyncAt.getTime() < 20_000) return NextResponse.json({ ok: true, skipped: "recently synced" });
    const r = await syncConnection(conn.id);
    return NextResponse.json({ ok: r.ok, blocks: r.blocks, ...(r.error ? { error: r.error } : {}) }, { status: r.ok ? 200 : 502 });
  }

  const valid = verifySignature({
    secret: conn.liveSecret,
    timestamp: req.headers.get("x-biznest-timestamp"),
    signature: req.headers.get("x-biznest-signature"),
    rawBody: raw,
  });
  if (!valid) return NextResponse.json({ error: "Bad signature" }, { status: 401 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Body is not valid JSON" }, { status: 400 }); }
  const parsed = parseInboundEvents(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await applyInboundEvents(conn, parsed.events);
  return NextResponse.json({ ok: true, ...result });
}
