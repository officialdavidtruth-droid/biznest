import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const TOKEN_RE = /^[a-f0-9]{40}$/;

/** The agent reports a job: { ok: true, externalId?: string } or { ok: false, error: string }. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limited = await checkRateLimit(`pmsbridge:${token}`, 240, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const integration = await prisma.lockIntegration.findUnique({ where: { bridgeToken: token }, select: { storeId: true, provider: true } });
  if (!integration || integration.provider !== "BRIDGE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const grant = await prisma.stayAccessGrant.findFirst({ where: { id, storeId: integration.storeId, provider: "BRIDGE" } });
  if (!grant) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let body: { ok?: unknown; externalId?: unknown; error?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const ok = body.ok === true;
  const error = typeof body.error === "string" ? body.error.slice(0, 200) : null;
  const externalId = typeof body.externalId === "string" ? body.externalId.slice(0, 120) : grant.externalId;

  if (grant.status === "PENDING") {
    await prisma.stayAccessGrant.update({ where: { id }, data: ok ? { status: "ACTIVE", externalId, error: null } : { status: "FAILED", error: error || "The on-site system refused the key." } });
  } else if (grant.status === "REVOKE_PENDING") {
    await prisma.stayAccessGrant.update({ where: { id }, data: ok ? { status: "REVOKED", error: null } : { error: error || "The on-site system did not remove the key." } });
  }
  return NextResponse.json({ ok: true });
}
