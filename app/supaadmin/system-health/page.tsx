import { getSystemHealth, listRecentSystemEvents, getApiLatencyStats } from "@/lib/actions/system-health";
import type { HealthStatus } from "@/lib/actions/system-health";
import type { SystemEvent } from "@prisma/client";

export const dynamic = "force-dynamic"; // always live — never cache a health page

const DOT: Record<HealthStatus, string> = { ok: "🟢", degraded: "🟡", down: "🔴" };
const STATUS_LABEL: Record<HealthStatus, string> = { ok: "Healthy", degraded: "Degraded", down: "Down" };

function timeAgo(date: Date | null) {
  if (!date) return "No recent issues";
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function SystemHealthPage() {
  const [health, recentEvents, latency] = await Promise.all([
    getSystemHealth(),
    listRecentSystemEvents(),
    getApiLatencyStats(),
  ]);

  if (!health) {
    return <p className="text-sm text-muted-foreground">Not authorized.</p>;
  }

  const overallDown = health.some((h) => h.status === "down");
  const overallDegraded = health.some((h) => h.status === "degraded");

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">System health</h1>
        <p className="text-sm text-muted-foreground">
          Live status across the last 30 minutes, refreshed on every page load.
        </p>
      </div>

      <div
        className="mb-6 rounded-lg border px-4 py-3 text-sm font-medium"
        style={{
          background: overallDown ? "hsl(0 84% 96%)" : overallDegraded ? "hsl(45 93% 96%)" : "hsl(142 71% 96%)",
          color: overallDown ? "hsl(0 74% 42%)" : overallDegraded ? "hsl(32 81% 38%)" : "hsl(142 71% 30%)",
        }}
      >
        {overallDown
          ? "🔴 One or more systems are down — check the categories below."
          : overallDegraded
            ? "🟡 Everything is up, but a few categories are showing warnings."
            : "🟢 All systems normal."}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((h) => (
          <div key={h.category} className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {DOT[h.status]} {h.label}
              </p>
              <span className="text-xs text-muted-foreground">{STATUS_LABEL[h.status]}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {h.errorCount} error{h.errorCount === 1 ? "" : "s"}, {h.warnCount} warning{h.warnCount === 1 ? "" : "s"} · last 30m
            </p>
            {h.category === "API" && latency && latency.sampleCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                avg {latency.avgMs}ms · max {latency.maxMs}ms ({latency.sampleCount} calls, last hour)
              </p>
            )}
            <p className="mt-2 truncate text-xs" title={h.lastMessage ?? undefined}>
              {h.lastMessage ? h.lastMessage : <span className="text-muted-foreground">No recent issues</span>}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(h.lastEventAt)}</p>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent events</h2>
        <p className="text-xs text-muted-foreground">Most recent 100, all categories</p>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.map((e: SystemEvent) => (
              <tr key={e.id} className="border-b last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background:
                        e.level === "ERROR" ? "hsl(0 84% 95%)" : e.level === "WARN" ? "hsl(45 93% 92%)" : "hsl(var(--muted))",
                      color: e.level === "ERROR" ? "hsl(0 74% 42%)" : e.level === "WARN" ? "hsl(32 81% 38%)" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {e.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.category}</td>
                <td className="max-w-md truncate px-4 py-3" title={e.metadata ? JSON.stringify(e.metadata) : ""}>
                  {e.message}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.durationMs != null ? `${e.durationMs}ms` : "—"}</td>
              </tr>
            ))}
            {recentEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
