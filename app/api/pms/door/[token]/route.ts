import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { decideAccess, READER_TOKEN_RE } from "@/lib/pms/door-access";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Door-reader endpoint. A lock controller sends  POST /api/pms/door/<reader token>
 * with JSON  { "cardUid": "04A1B2C3" }  (or ?cardUid=... for very small devices) and gets
 * { "allow": true|false, "reason": "..." }. Open the relay only when "allow" is true.
 * Every scan is logged. An expired card is revoked the first time it is scanned.
 */
async function handle(req: Request, params: Promise<{ token: string }>) {
  const { token } = await params;
  if (!READER_TOKEN_RE.test(token)) return NextResponse.json({ allow: false, reason: "Not found" }, { status: 404 });

  const limited = await checkRateLimit(`pmsdoor:${token}`, 120, 60_000);
  if (!limited.allowed) return NextResponse.json({ allow: false, reason: "Too many requests" }, { status: 429 });

  const reader = await prisma.doorReader.findUnique({ where: { token }, select: { id: true, storeId: true, roomId: true, isActive: true } });
  if (!reader || !reader.isActive) return NextResponse.json({ allow: false, reason: "Not found" }, { status: 404 });

  let cardUid = new URL(req.url).searchParams.get("cardUid") ?? "";
  if (!cardUid && req.method === "POST") {
    try {
      const body = (await req.json()) as { cardUid?: unknown };
      if (typeof body.cardUid === "string") cardUid = body.cardUid;
    } catch { /* fall through to the validation below */ }
  }
  cardUid = cardUid.trim();
  if (!cardUid || cardUid.length > 120) return NextResponse.json({ allow: false, reason: "cardUid is required" }, { status: 400 });

  const card = await prisma.roomAccessCard.findUnique({
    where: { storeId_cardUid: { storeId: reader.storeId, cardUid } },
    include: { reservation: { select: { status: true, checkOut: true } }, room: { select: { id: true, status: true } } },
  });

  const decision = decideAccess({
    card: card ? { id: card.id, roomId: card.roomId, status: card.status, expiresAt: card.expiresAt, reservation: card.reservation } : null,
    cardRoom: card?.room ?? null,
    reader: { roomId: reader.roomId },
  });

  await Promise.all([
    prisma.roomAccessScan.create({ data: { storeId: reader.storeId, readerId: reader.id, cardUid, cardId: card?.id ?? null, allowed: decision.allowed, reason: decision.reason } }),
    prisma.doorReader.update({ where: { id: reader.id }, data: { lastSeenAt: new Date() } }),
    card && card.status === "ACTIVE" && !decision.allowed && (decision.reason === "Card expired" || decision.reason === "Stay has ended")
      ? prisma.roomAccessCard.update({ where: { id: card.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedReason: decision.reason } })
      : Promise.resolve(null),
  ]).catch(() => undefined);

  return NextResponse.json({ allow: decision.allowed, reason: decision.reason, room: card?.roomId && decision.allowed ? card.roomId : undefined });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) { return handle(req, ctx.params); }
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) { return handle(req, ctx.params); }
