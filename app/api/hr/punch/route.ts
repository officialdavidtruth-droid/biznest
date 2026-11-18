import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deviceKeyMatches, recordPunches, scansToPunches } from "@/lib/hr/attendance-service";

/**
 * Generic scan upload for any scanner or script: the BizNest bridge, a vendor SDK, or your own
 * code. POST JSON { serial, punches: [{ userId, time }] } with `Authorization: Bearer <device key>`.
 * `time` is "YYYY-MM-DD HH:MM:SS" in the device's local time, or an ISO string with a zone.
 * Safe to resend: duplicates are ignored.
 */
export const dynamic = "force-dynamic";

const Body = z.object({
  serial: z.string().min(1).max(100),
  punches: z.array(z.object({ userId: z.string().min(1).max(40), time: z.string().min(10).max(40) })).min(1).max(5000),
});

export async function POST(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { serial, punches: [{ userId, time }] }." }, { status: 400 });

  const device = await prisma.hrBiometricDevice.findUnique({ where: { serialNumber: parsed.data.serial } });
  // Same message for unknown serial and wrong key, so serials can't be probed.
  if (!device || !key || !deviceKeyMatches(key, device.apiKeyHash)) return NextResponse.json({ error: "Invalid device or key." }, { status: 401 });

  const scans = parsed.data.punches.map((p) => ({ userId: p.userId, time: p.time, state: null, verify: null }));
  const { punches, skipped } = scansToPunches(scans, device);
  const result = await recordPunches(device.storeId, punches);
  await prisma.hrBiometricDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), ...(punches.length ? { lastPunchAt: punches.reduce((a, b) => (a.at > b.at ? a : b)).at } : {}) },
  });
  return NextResponse.json({ ok: true, ...result, skipped });
}
