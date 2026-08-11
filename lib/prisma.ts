import { PrismaClient } from "@prisma/client";

// Prevents exhausting DB connections in dev due to Next.js hot-reload
// re-instantiating the client on every file change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // "error"/"warn" here are emitted as *events* (not just stdout) so
    // lib/observability/wire-prisma-events.ts can forward them into
    // SystemEvent -- that's what powers the DB dot on System Health.
    // Query logging in dev stays on stdout only; it's too high-volume to
    // want in the SystemEvent table.
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "query" }, { emit: "event", level: "error" }, { emit: "event", level: "warn" }]
        : [{ emit: "event", level: "error" }, { emit: "event", level: "warn" }],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Wired lazily (not at module top-level) to dodge a circular import: this
// file (@/lib/prisma) is imported by lib/observability/log.ts, which is
// imported by lib/observability/wire-prisma-events.ts, which needs `prisma`
// from here.
import("@/lib/observability/wire-prisma-events").then((m) => m.wirePrismaEvents(prisma));
