import { NextResponse } from "next/server";
import { logEvent, errorMeta } from "@/lib/observability/log";

/**
 * Wraps a Route Handler to record API latency for every call and an ERROR
 * event for anything that throws, tagged with the route name. Doesn't
 * change response behavior on success; on an uncaught throw it logs and
 * returns a generic 500 (matching what Next's default error handling would
 * have done anyway, just with a paper trail).
 *
 * Usage:
 *   export const POST = withObservability("upload", async (req) => { ... });
 */
export function withObservability<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    const start = Date.now();
    try {
      const res = await handler(...args);
      void logEvent("API", res.ok ? "INFO" : "WARN", `${routeName} ${res.status}`, { route: routeName, status: res.status }, Date.now() - start);
      return res;
    } catch (err) {
      const durationMs = Date.now() - start;
      void logEvent("API", "ERROR", `${routeName} threw`, errorMeta(err, { route: routeName }), durationMs);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
