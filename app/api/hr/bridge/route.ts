import { NextResponse } from "next/server";
import { BRIDGE_SCRIPT } from "@/lib/hr/bridge-script";

// Public on purpose: the script contains no secrets (each business supplies its own device keys).
export const dynamic = "force-static";
export function GET() {
  return new NextResponse(BRIDGE_SCRIPT, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Content-Disposition": 'attachment; filename="biznest-bridge.mjs"' },
  });
}
