import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { performUnsubscribe } from "@/lib/email/perform-unsubscribe";

/**
 * RFC 8058 one-click unsubscribe endpoint. This is what mailbox providers
 * (Gmail, Yahoo, etc.) call directly from their built-in "Unsubscribe"
 * button when a message carries `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
 * — see the header set in lib/email/send.ts. Per the RFC, a POST here must
 * complete the unsubscribe immediately with no further confirmation step;
 * the human-facing confirm-then-click flow lives at /unsubscribe instead.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`unsubscribe-oneclick:${ip}`, 20, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  await performUnsubscribe(token);
  // Always 200 regardless of token validity — mirrors the confirm page and
  // avoids leaking whether a given token/address exists.
  return NextResponse.json({ ok: true });
}
