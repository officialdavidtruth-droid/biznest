import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { classifyPagePath } from "@/lib/page-usage";

export const runtime = "nodejs";

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i;
const PLATFORM_HOST = /^(www\.|supaadmin\.)?biznest\.space$|^localhost(:\d+)?$|\.vercel\.app$/i;

/**
 * Counts one page view for the super-admin "Page usage" report. Best effort: it always answers 204 so a
 * tracking hiccup can never show up as an error in someone's browser.
 */
export async function POST(req: Request) {
  try {
    if (BOT.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
    const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
    if (!body || typeof body.path !== "string") return new NextResponse(null, { status: 204 });

    const onPlatform = PLATFORM_HOST.test(req.headers.get("host") ?? "");
    const page = classifyPagePath(body.path, onPlatform);
    if (!page) return new NextResponse(null, { status: 204 });

    const session = await auth().catch(() => null);
    const signedIn = session?.user ? 1 : 0;
    // The day is the Lagos calendar day (UTC+1, no daylight saving).
    const day = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

    await prisma.$executeRaw`
      INSERT INTO "PlatformPageStat" ("id", "day", "path", "area", "views", "signedInViews")
      VALUES (${randomUUID()}, ${day}::date, ${page.path}, ${page.area}, 1, ${signedIn})
      ON CONFLICT ("day", "path")
      DO UPDATE SET "views" = "PlatformPageStat"."views" + 1,
                    "signedInViews" = "PlatformPageStat"."signedInViews" + ${signedIn}`;
  } catch {
    // Analytics must never break anything.
  }
  return new NextResponse(null, { status: 204 });
}
