import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;
const TOKEN_RE = /^[a-f0-9]{40}$/;

/**
 * For the on-site agent of a lock system BizNest cannot reach from the internet (e.g. ASSA ABLOY Visionline).
 * GET returns the work to do: { jobs: [{ id, action: "ISSUE" | "REVOKE", lock, room, guest, validFrom, validTo }] }.
 * The agent does it locally, then POSTs the result to /jobs/<id>.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limited = await checkRateLimit(`pmsbridge:${token}`, 120, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const integration = await prisma.lockIntegration.findUnique({ where: { bridgeToken: token }, select: { id: true, storeId: true, provider: true } });
  if (!integration || integration.provider !== "BRIDGE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.lockIntegration.update({ where: { id: integration.id }, data: { bridgeLastSeenAt: new Date() } });

  const grants = await prisma.stayAccessGrant.findMany({
    where: { storeId: integration.storeId, provider: "BRIDGE", status: { in: ["PENDING", "REVOKE_PENDING"] } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const reservations = await prisma.propertyReservation.findMany({
    where: { id: { in: grants.map((g) => g.reservationId) } },
    select: { id: true, guest: { select: { fullName: true } }, room: { select: { name: true } } },
  });
  const byId = new Map(reservations.map((r) => [r.id, r]));
  return NextResponse.json({
    jobs: grants.map((g) => ({
      id: g.id,
      action: g.status === "PENDING" ? "ISSUE" : "REVOKE",
      lock: g.lockId,
      room: byId.get(g.reservationId)?.room.name ?? null,
      guest: byId.get(g.reservationId)?.guest.fullName ?? null,
      externalId: g.externalId,
      validFrom: g.startsAt.toISOString(),
      validTo: g.endsAt.toISOString(),
    })),
  });
}
