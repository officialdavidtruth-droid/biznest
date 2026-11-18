import { NextResponse } from "next/server";

// Scanners report command results here; we issue no commands, so just acknowledge.
export const dynamic = "force-dynamic";
export async function POST() {
  return new NextResponse("OK", { headers: { "Content-Type": "text/plain" } });
}
