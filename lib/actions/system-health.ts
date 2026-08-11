"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import type { EventCategory } from "@prisma/client";

// Same gate as lib/actions/admin.ts's assertPlatformStaff — duplicated
// rather than imported since that one isn't exported, and this file wants
// to stay independently readable as "the observability actions".
async function assertPlatformStaff() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) return { success: false as const };
  return { success: true as const };
}

const WINDOW_MS = 30 * 60 * 1000; // last 30 minutes drives the dot color
const RECENT_LIMIT = 100;

export type HealthStatus = "ok" | "degraded" | "down";

export type CategoryHealth = {
  category: EventCategory;
  label: string;
  status: HealthStatus;
  errorCount: number;
  warnCount: number;
  lastEventAt: Date | null;
  lastMessage: string | null;
};

const LABELS: Record<EventCategory, string> = {
  DATABASE: "Database",
  PAYMENTS: "Payments",
  EMAIL: "Email",
  WEBHOOKS: "Webhooks",
  STORAGE: "Storage",
  AUTH: "Authentication",
  API: "API",
  JOBS: "Background jobs",
};

// Rough, deliberately simple thresholds -- this isn't trying to be a real
// alerting system with per-category baselines, just "is anything on fire
// right now" at a glance. Tune these if a category turns out noisy.
function statusFor(errorCount: number, warnCount: number): HealthStatus {
  if (errorCount >= 3) return "down";
  if (errorCount > 0 || warnCount >= 5) return "degraded";
  return "ok";
}

/**
 * One row per category for the 🟢/🟡/🔴 grid on /supaadmin/system-health.
 * Also folds in WebhookDelivery's own FAILED count, since that table is
 * the authoritative webhook record (SystemEvent only gets a WEBHOOKS entry
 * when a delivery is retried or exhausted via the cron sweep / inline
 * attempt — this catches anything in between).
 */
export async function getSystemHealth(): Promise<CategoryHealth[] | null> {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const since = new Date(Date.now() - WINDOW_MS);
  const categories = Object.keys(LABELS) as EventCategory[];

  const grouped = await prisma.systemEvent.groupBy({
    by: ["category", "level"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  // WebhookDelivery is the authoritative webhook record; fold its recent
  // FAILED count in as extra WARN-equivalent signal even if no SystemEvent
  // fired for a given delivery.
  const recentFailedDeliveries = await prisma.webhookDelivery.count({
    where: { status: "FAILED", lastAttemptAt: { gte: since } },
  });

  const lastEvents = await Promise.all(
    categories.map((category) =>
      prisma.systemEvent.findFirst({
        where: { category, level: { in: ["ERROR", "WARN"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, message: true },
      })
    )
  );

  return categories.map((category, i) => {
    let errorCount = grouped.find((g: { category: EventCategory; level: string }) => g.category === category && g.level === "ERROR")?._count._all ?? 0;
    const warnCount = grouped.find((g: { category: EventCategory; level: string }) => g.category === category && g.level === "WARN")?._count._all ?? 0;
    if (category === "WEBHOOKS") errorCount += recentFailedDeliveries;
    const last = lastEvents[i];
    return {
      category,
      label: LABELS[category],
      status: statusFor(errorCount, warnCount),
      errorCount,
      warnCount,
      lastEventAt: last?.createdAt ?? null,
      lastMessage: last?.message ?? null,
    };
  });
}

export async function listRecentSystemEvents(params: { category?: EventCategory; level?: "INFO" | "WARN" | "ERROR" } = {}) {
  const access = await assertPlatformStaff();
  if (!access.success) return [];

  return prisma.systemEvent.findMany({
    where: {
      ...(params.category ? { category: params.category } : {}),
      ...(params.level ? { level: params.level } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
  });
}

/** Average + p95-ish (max) API latency over the last hour, for the API row's detail line. */
export async function getApiLatencyStats() {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await prisma.systemEvent.findMany({
    where: { category: "API", durationMs: { not: null }, createdAt: { gte: since } },
    select: { durationMs: true },
  });
  if (rows.length === 0) return { avgMs: null, maxMs: null, sampleCount: 0 };

  const durations = rows.map((r: { durationMs: number | null }) => r.durationMs ?? 0);
  const avgMs = Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length);
  const maxMs = Math.max(...durations);
  return { avgMs, maxMs, sampleCount: durations.length };
}
