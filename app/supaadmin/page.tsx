import { getPlatformStats } from "@/lib/actions/admin";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Users, ShieldAlert, Store,
  ShoppingCart, Ban, ArrowRight,
} from "lucide-react";

export default async function SupaAdminOverview() {
  const stats = await getPlatformStats();
  if (!stats) return null;

  const cards = [
    { label: "Gross merchandise value", value: `₦${stats.gmv.toLocaleString()}`, icon: DollarSign },
    { label: "Monthly recurring revenue", value: `₦${stats.mrr.toLocaleString()}`, icon: TrendingUp },
    { label: "Total users", value: stats.totalUsers, icon: Users },
    {
      label: "Pending business reviews",
      value: stats.pendingBusinesses,
      href: "/supaadmin/businesses",
      highlight: stats.pendingBusinesses > 0,
      icon: ShieldAlert,
    },
    { label: "Total stores", value: stats.totalStores, icon: Store },
    { label: "Total orders", value: stats.totalOrders, icon: ShoppingCart },
    { label: "Banned users", value: stats.bannedUsers, icon: Ban },
  ];

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const card = (
            <div
              className="rounded-2xl p-4 transition-colors"
              style={{
                background: "hsl(var(--muted))",
                border: `1px solid ${c.highlight ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "hsl(var(--primary) / 0.15)" }}
                >
                  <Icon size={14} style={{ color: "hsl(var(--primary))" }} />
                </div>
                {c.href && <ArrowRight size={12} style={{ color: "hsl(var(--muted-foreground))" }} />}
              </div>
              <p className="mt-3 text-2xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
                {c.value}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {c.label}
              </p>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>
              {card}
            </Link>
          ) : (
            <div key={c.label}>{card}</div>
          );
        })}
      </div>

      {stats.pendingBusinesses > 0 && (
        <div
          className="rounded-2xl p-4 text-sm"
          style={{ background: "hsl(var(--primary) / 0.08)", border: "1px solid hsl(var(--primary) / 0.35)", color: "hsl(var(--foreground))" }}
        >
          You have <strong>{stats.pendingBusinesses}</strong> business verification{" "}
          {stats.pendingBusinesses === 1 ? "request" : "requests"} waiting for review.{" "}
          <Link href="/supaadmin/businesses" className="font-semibold" style={{ color: "hsl(var(--primary))" }}>
            Review now →
          </Link>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
            Recent activity
          </h2>
          <Link href="/supaadmin/logs" className="text-xs font-semibold" style={{ color: "hsl(var(--primary))" }}>
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
          <ul>
            {stats.recentLogs.map((log, i) => (
              <li
                key={log.id}
                className="flex items-center justify-between px-4 py-3 text-xs"
                style={i < stats.recentLogs.length - 1 ? { borderBottom: "1px solid hsl(var(--border))" } : undefined}
              >
                <div>
                  <span className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                    {log.user?.email ?? "System"}
                  </span>{" "}
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    — {log.action.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
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
  );
}
