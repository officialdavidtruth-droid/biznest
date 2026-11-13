import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendAlert } from "@/lib/observability/alert";
import type { EventCategory, EventLevel, Prisma } from "@prisma/client";

// Circuit breaker for the log write itself. Prisma error events are forwarded into logEvent, and logEvent
// writes to the same database -- so when the DB is saturated (e.g. "max client connections reached") every
// failed write raised another error event, which tried another write: ~40,000 failed writes in one minute on
// 2026-11-11, which kept the connection pool pinned and kept logins failing. After one failed write we stop
// writing rows for a short while (console only) so the database can recover.
let dbWriteBlockedUntil = 0;
const DB_WRITE_COOLDOWN_MS = 30_000;

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

  if (Date.now() >= dbWriteBlockedUntil) try {
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
    dbWriteBlockedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
    // If we can't even write the log row (e.g. the DB itself is down --
    // which is exactly when we'd most want a DATABASE event to exist),
    // there's nowhere left to put this but stderr.
    console.error("[observability] failed to persist SystemEvent:", err);
  }

  if (level === "ERROR") await escalate(category, message, metadata);
}

// Unexpected failures in these areas page the owner directly. JOBS is covered
// per-cron by withCronMonitor (lib/observability/cron.ts), so it isn't here.
const ALERT_CATEGORIES = new Set<EventCategory>(["PAYMENTS", "DATABASE"]);

async function escalate(category: EventCategory, message: string, metadata?: Record<string, unknown>) {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("category", category);
      scope.setFingerprint([category, message]);
      if (metadata) scope.setExtras(metadata);
      Sentry.captureMessage(`[${category}] ${message}`, "error");
    });
  } catch {
    /* Sentry must never break the caller */
  }

  if (ALERT_CATEGORIES.has(category) && !metadata?.skipAlert) {
    const detail = metadata ? JSON.stringify(metadata).slice(0, 700) : "";
    await sendAlert({
      key: `event:${category}`,
      subject: `[BizNest] ${category} error`,
      body: `${message}\n\n${detail}\n\nDetails: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space"}/supaadmin/system-health`,
      throttleMinutes: 30,
    });
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
