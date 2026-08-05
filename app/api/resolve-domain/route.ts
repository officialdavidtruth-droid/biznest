import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/resolve-domain?host=mystore.com
 *
 * Runs on Node.js (default runtime for Route Handlers) so it can use Prisma
 * safely. middleware.ts calls this via fetch() for any host that isn't
 * biznest.space itself — middleware runs on the Edge Runtime, which cannot
 * use Prisma Client directly (see lib/auth.config.ts for the exact same
 * lesson learned the hard way with auth).
 *
 * Known trade-off: this adds one network round-trip per custom-domain
 * request, since there's no edge-cached lookup layer (Vercel Edge Config)
 * wired up yet. Fine at 50-user scale; worth revisiting if custom domains
 * see meaningful traffic later.
 */
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host")?.toLowerCase().trim();
  if (!host) return NextResponse.json({ slug: null }, { status: 400 });

  const store = await prisma.store.findUnique({
    where: { customDomain: host },
    select: { slug: true, status: true },
  });

  if (!store || store.status !== "ACTIVE") {
    return NextResponse.json({ slug: null }, { status: 404 });
  }

  return NextResponse.json({ slug: store.slug });
}
