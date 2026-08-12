import { getPlatformStats } from "@/lib/actions/admin";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Users, ShieldAlert, Store,
  ShoppingCart, Ban, ArrowRight, Gavel, Clock,
} from "lucide-react";

export default async function SupaAdminOverview() {
  const stats = await getPlatformStats();
  if (!stats) return null;

  const secondaryCards = [
    { label: "Total users", value: stats.totalUsers.toLocaleString(), icon: Users },
    { label: "Total stores", value: stats.totalStores.toLocaleString(), icon: Store },
    { label: "Total orders", value: stats.totalOrders.toLocaleString(), icon: ShoppingCart },
    { label: "Banned users", value: stats.bannedUsers.toLocaleString(), icon: Ban },
  ];

  const attentionItems = [
    stats.pendingBusinesses > 0 && {
      href: "/supaadmin/businesses",
      icon: ShieldAlert,
      count: stats.pendingBusinesses,
      label: stats.pendingBusinesses === 1 ? "business awaiting verification" : "businesses awaiting verification",
    },
    stats.openDisputes > 0 && {
      href: "/supaadmin/disputes",
      icon: Gavel,
      count: stats.openDisputes,
      label: stats.openDisputes === 1 ? "dispute in the resolution center" : "disputes in the resolution center",
    },
  ].filter(Boolean) as { href: string; icon: typeof ShieldAlert; count: number; label: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
          Platform overview
        </h1>
        <p className="mt-0.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          A snapshot of BizNest across every store.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Headline financial metrics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: "Gross merchandise value", value: `₦${stats.gmv.toLocaleString()}`, icon: DollarSign },
              { label: "Monthly recurring revenue", value: `₦${stats.mrr.toLocaleString()}`, icon: TrendingUp },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="relative overflow-hidden rounded-2xl p-5"
                  style={{ background: "var(--bn-accent-gradient)" }}
                >
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full"
                    style={{ background: "hsl(var(--background) / 0.12)" }}
                  />
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "hsl(var(--background) / 0.18)" }}
                  >
                    <Icon size={14} style={{ color: "hsl(var(--primary-foreground))" }} />
                  </div>
                  <p className="relative mt-3 text-2xl font-bold" style={{ color: "hsl(var(--primary-foreground))" }}>
                    {c.value}
                  </p>
                  <p className="relative mt-0.5 text-[11px] font-medium" style={{ color: "hsl(var(--primary-foreground) / 0.85)" }}>
                    {c.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {secondaryCards.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="rounded-2xl p-4"
                  style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "hsl(var(--primary) / 0.15)" }}
                  >
                    <Icon size={14} style={{ color: "var(--bn-marigold)" }} />
                  </div>
                  <p className="mt-3 text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
                    {c.value}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {c.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Recent activity */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                Recent activity
              </h2>
              <Link href="/supaadmin/logs" className="text-xs font-semibold" style={{ color: "var(--bn-marigold)" }}>
                View all →
              </Link>
            </div>
            <div className="overflow-hidden rounded-2xl" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
              <ul>
                {stats.recentLogs.map((log, i) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-3 text-xs transition-colors hover:bg-[hsl(var(--background)/0.4)]"
                    style={i < stats.recentLogs.length - 1 ? { borderBottom: "1px solid hsl(var(--border))" } : undefined}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "hsl(var(--primary) / 0.12)" }}
                    >
                      <Clock size={11} style={{ color: "var(--bn-marigold)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                        {log.user?.email ?? "System"}
                      </span>{" "}
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>
                        — {log.action.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <span className="shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
                {stats.recentLogs.length === 0 && (
                  <li className="px-4 py-10 text-center text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    No activity yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Side column — needs attention */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
            Needs attention
          </h2>
          {attentionItems.length === 0 ? (
            <div
              className="rounded-2xl p-5 text-xs"
              style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              Nothing waiting on you right now — the queue is clear.
            </div>
          ) : (
            attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-2xl p-4 transition-colors"
                  style={{ background: "hsl(var(--primary) / 0.08)", border: "1px solid hsl(var(--primary) / 0.3)" }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--bn-accent-gradient)" }}
                  >
                    <Icon size={15} style={{ color: "hsl(var(--primary-foreground))" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
                      {item.count}
                    </p>
                    <p className="text-[11px] leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {item.label}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--bn-marigold)" }}
                  />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
