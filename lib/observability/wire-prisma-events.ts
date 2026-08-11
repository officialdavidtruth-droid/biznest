import type { PrismaClient } from "@prisma/client";
import { logEvent } from "@/lib/observability/log";

let wired = false;

/**
 * Subscribes to Prisma's "error"/"warn" log events and forwards them into
 * SystemEvent under the DATABASE category. Guarded with a module-level flag
 * since lib/prisma.ts's dev hot-reload guard can otherwise re-wire this on
 * every file change and stack up duplicate listeners.
 */
export function wirePrismaEvents(client: PrismaClient) {
  if (wired) return;
  wired = true;

  // Cast rather than @ts-expect-error: whether these event callbacks are
  // properly typed depends on the `log` config generic Prisma infers at
  // construction, which varies enough across Prisma versions/setups that a
  // suppression comment risks going stale (and erroring as "unused") in
  // either direction. A plain cast is inert either way.
  const onClient = client as unknown as {
    $on: (event: "error" | "warn", cb: (e: { message: string; target?: string }) => void) => void;
  };

  onClient.$on("error", (e) => {
    void logEvent("DATABASE", "ERROR", "Prisma error event", { message: e.message, target: e.target });
  });
  onClient.$on("warn", (e) => {
    void logEvent("DATABASE", "WARN", "Prisma warning event", { message: e.message });
  });
}
