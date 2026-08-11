import { prisma } from "@/lib/prisma";
import type { EventCategory, EventLevel, Prisma } from "@prisma/client";

/**
 * Central write path for everything on the System Health page. Every
 * failure mode we care about (payment declines, bounced emails, dead
 * webhooks, DB errors, auth failures, upload failures, background-job
 * crashes, slow API calls) should funnel through here instead of a bare
 * console.error, so it's actually visible somewhere other than a log
 * stream nobody's watching.
 *
 * Deliberately never throws -- a logging failure should never be the thing
 * that takes down the request that was trying to report a *different*
 * failure. Worst case it just falls back to console.
 */
export async function logEvent(
  category: EventCategory,
  level: EventLevel,
  message: string,
  metadata?: Record<string, unknown>,
  durationMs?: number
): Promise<void> {
  const consoleFn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
  consoleFn(`[${category}] ${message}`, metadata ?? "");

  try {
    await prisma.systemEvent.create({
      data: {
        category,
        level,
        message: message.slice(0, 2000),
        metadata: metadata as Prisma.InputJsonValue,
        durationMs,
      },
    });
  } catch (err) {
    // If we can't even write the log row (e.g. the DB itself is down --
    // which is exactly when we'd most want a DATABASE event to exist),
    // there's nowhere left to put this but stderr.
    console.error("[observability] failed to persist SystemEvent:", err);
  }
}

export const logError = (category: EventCategory, message: string, metadata?: Record<string, unknown>) =>
  logEvent(category, "ERROR", message, metadata);

export const logWarn = (category: EventCategory, message: string, metadata?: Record<string, unknown>) =>
  logEvent(category, "WARN", message, metadata);

export const logInfo = (category: EventCategory, message: string, metadata?: Record<string, unknown>, durationMs?: number) =>
  logEvent(category, "INFO", message, metadata, durationMs);

/** Normalizes anything caught in a try/catch into loggable shape. */
export function errorMeta(err: unknown, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extra,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : undefined,
  };
}
