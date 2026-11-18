import { NextResponse } from "next/server";
import { touchDeviceBySerial } from "@/lib/hr/attendance-service";

// Scanners poll this for commands. We never send any, but answering keeps the device marked online.
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const sn = new URL(req.url).searchParams.get("SN")?.trim();
  if (!sn) return new NextResponse("Missing SN", { status: 400 });
  const device = await touchDeviceBySerial(sn);
  if (!device) return new NextResponse("Device not registered", { status: 403 });
  return new NextResponse("OK", { headers: { "Content-Type": "text/plain" } });
}
