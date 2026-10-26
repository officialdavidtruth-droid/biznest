import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";
import { sendAlert } from "@/lib/observability/alert";
import { logError, errorMeta } from "@/lib/observability/log";
import { CRON_BY_NAME, CRONS } from "@/lib/observability/cron-registry";

/**
 * Wraps a /api/cron/* handler so that:
 *  - the request is authenticated (CRON_SECRET) exactly as before;
 *  - a Sentry Crons check-in is sent (in_progress -> ok/error), so Sentry also
 *    alerts when a run is MISSED or runs too long (e.g. killed by a timeout);
 *  - a heartbeat row is written to SystemEvent (read by /api/health/crons and
 *    the watchdog job, and shown on the System Health page);
 *  - a failed run (throw, 5xx, or ctx.fail()) pages the owner immediately.
 *
 * ctx.fail() is for "the job ran but something that matters went wrong"
 * (e.g. Paystack unreachable during renewals). Ordinary business outcomes,
 * such as a customer's card being declined, are NOT failures.
 */
export type CronContext = { fail: (message: string, meta?: Record<string, unknown>) => void };

type Handler = (req: Request, ctx: CronContext) => Promise<Response>;

export function withCronMonitor(name: string, handler: Handler) {
  return async function GET(req: Request): Promise<Response> {
    const denied = requireCronAuth(req);
    if (denied) return denied;

    const def = CRON_BY_NAME[name];
    const started = Date.now();
    const problems: { message: string; meta?: Record<string, unknown> }[] = [];
    const ctx: CronContext = { fail: (message, meta) => problems.push({ message, meta }) };

    let checkInId: string | undefined;
    try {
      checkInId = Sentry.captureCheckIn(
        { monitorSlug: name, status: "in_progress" },
        def
          ? {
              schedule: { type: "crontab", value: def.schedule },
              timezone: "UTC",
              checkinMargin: 30, // minutes late before "missed"
              maxRuntime: 10, // minutes before "timed out"
              failureIssueThreshold: 1,
              recoveryThreshold: 1,
            }
          : undefined
      );
    } catch {
      /* monitoring must never block the job */
    }

    let response: Response;
    let thrown: unknown = null;
    try {
      response = await handler(req, ctx);
    } catch (err) {
      thrown = err;
      Sentry.captureException(err, { tags: { cron: name } });
      response = NextResponse.json({ ok: false, error: "cron failed" }, { status: 500 });
    }

    const durationMs = Date.now() - started;
    if (thrown) problems.push({ message: `Unhandled exception: ${thrown instanceof Error ? thrown.message : String(thrown)}` });
    else if (response.status >= 500) problems.push({ message: `Responded HTTP ${response.status}` });

    const failed = problems.length > 0;
    const summary = await summarize(response);

    try {
      Sentry.captureCheckIn({ checkInId, monitorSlug: name, status: failed ? "error" : "ok", duration: durationMs / 1000 });
    } catch {
      /* ignore */
    }

    await recordHeartbeat(name, failed, durationMs, summary, problems.map((p) => p.message));

    if (failed) {
      const lines = problems.slice(0, 10).map((p) => `• ${p.message}${p.meta ? " " + JSON.stringify(p.meta).slice(0, 200) : ""}`);
      void logError("JOBS", `Cron ${name} failed`, errorMeta(thrown, { cron: name, problems: lines, skipAlert: true }));
      await sendAlert({
        key: `cron:${name}`,
        subject: `[BizNest] Cron FAILED: ${name}`,
        body: `${lines.join("\n")}\n\nResult: ${JSON.stringify(summary)}\nDuration: ${Math.round(durationMs / 1000)}s\nSystem health: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space"}/supaadmin/system-health`,
        throttleMinutes: 180,
      });
    }

    try {
      await Sentry.flush(2000);
    } catch {
      /* ignore */
    }
    return response;
  };
}

async function summarize(res: Response): Promise<Record<string, number | boolean>> {
  try {
    const json = (await res.clone().json()) as Record<string, unknown>;
    const out: Record<string, number | boolean> = {};
    for (const [k, v] of Object.entries(json)) if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

async function recordHeartbeat(
  name: string,
  failed: boolean,
  durationMs: number,
  summary: Record<string, number | boolean>,
  problems: string[]
) {
  try {
    await prisma.systemEvent.create({
      data: {
        category: "JOBS",
        level: failed ? "ERROR" : "INFO",
        message: `Cron ${name} ${failed ? "failed" : "ok"}`,
        metadata: { cron: name, status: failed ? "error" : "ok", summary, problems: problems.slice(0, 5) },
        durationMs,
      },
    });
  } catch (err) {
    console.error("[cron] could not record heartbeat:", err);
  }
}

// ---------------------------------------------------------------------------
// Health read side (used by /api/health/crons, the watchdog and System Health)
// ---------------------------------------------------------------------------

export type CronState = "ok" | "failing" | "stale" | "never_run";
export type CronHealth = {
  name: string;
  state: CronState;
  lastRunAt: Date | null;
  lastOkAt: Date | null;
  detail: string;
};

async function latest(name: string, status?: "ok") {
  return prisma.systemEvent.findFirst({
    where: {
      category: "JOBS",
      message: { startsWith: "Cron " },
      AND: [
        { metadata: { path: ["cron"], equals: name } },
        ...(status ? [{ metadata: { path: ["status"], equals: status } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadata: true },
  });
}

export async function checkCronHealth(now = new Date(), only?: string[]): Promise<CronHealth[]> {
  const defs = CRONS.filter((c) => !only || only.includes(c.name));
  return Promise.all(
    defs.map(async (c): Promise<CronHealth> => {
      const [lastRun, lastOk] = await Promise.all([latest(c.name), latest(c.name, "ok")]);
      const lastRunAt = lastRun?.createdAt ?? null;
      const lastOkAt = lastOk?.createdAt ?? null;
      const status = (lastRun?.metadata as { status?: string } | null)?.status;
      if (!lastRun) return { name: c.name, state: "never_run", lastRunAt, lastOkAt, detail: "No run recorded yet" };
      if (status === "error") return { name: c.name, state: "failing", lastRunAt, lastOkAt, detail: "Last run reported a failure" };
      const ageH = lastOkAt ? (now.getTime() - lastOkAt.getTime()) / 3_600_000 : Infinity;
      if (ageH > c.maxAgeHours) {
        return { name: c.name, state: "stale", lastRunAt, lastOkAt, detail: `No successful run in ${Math.round(ageH)}h (max ${c.maxAgeHours}h)` };
      }
      return { name: c.name, state: "ok", lastRunAt, lastOkAt, detail: "Healthy" };
    })
  );
}
