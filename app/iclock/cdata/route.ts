import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAttLog } from "@/lib/hr/attendance-core";
import { recordPunches, scansToPunches, touchDeviceBySerial } from "@/lib/hr/attendance-service";

/**
 * Push endpoint for ZKTeco-style fingerprint/face scanners (the "ADMS" / iClock protocol).
 * In the scanner's cloud-server settings, set the server address to this site and the device
 * calls: GET /iclock/cdata (handshake), then POST /iclock/cdata?table=ATTLOG with each scan.
 * Scanners identify themselves only by serial number, so the serial must be registered in
 * HR & Payroll > Scanners first; unknown serials are refused.
 */
export const dynamic = "force-dynamic";
const MAX_BODY = 1_000_000;
const text = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/plain" } });

export async function GET(req: Request) {
  const sn = new URL(req.url).searchParams.get("SN")?.trim();
  if (!sn) return text("Missing SN", 400);
  const device = await touchDeviceBySerial(sn);
  if (!device) return text("Device not registered", 403);
  // Handshake: tells the scanner to push attendance logs immediately and what to ignore.
  return text(
    [
      `GET OPTION FROM: ${sn}`,
      "ErrorDelay=60",
      "Delay=30",
      "TransTimes=00:00;14:05",
      "TransInterval=1",
      "TransFlag=TransData AttLog",
      "Realtime=1",
      "Encrypt=0",
      "",
    ].join("\n")
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const sn = url.searchParams.get("SN")?.trim();
  if (!sn) return text("Missing SN", 400);
  const device = await touchDeviceBySerial(sn);
  if (!device) return text("Device not registered", 403);

  const table = url.searchParams.get("table");
  const body = await req.text();
  if (body.length > MAX_BODY) return text("Too large", 413);
  // Only attendance rows matter; user/operation/biometric tables are acknowledged and dropped
  // (we never store fingerprint templates -- they stay on the scanner).
  if (table !== "ATTLOG") return text("OK");

  const scans = parseAttLog(body);
  const { punches } = scansToPunches(scans, device);
  const result = await recordPunches(device.storeId, punches);
  if (punches.length) {
    const latest = punches.reduce((a, b) => (a.at > b.at ? a : b)).at;
    await prisma.hrBiometricDevice.update({ where: { id: device.id }, data: { lastPunchAt: latest } });
  }
  return text(`OK:${scans.length}`);
}
