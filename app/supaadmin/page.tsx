import { getPlatformStats } from "@/lib/actions/admin";
import Link from "next/link";

export default async function SupaAdminOverview() {
  const stats = await getPlatformStats();
  if (!stats) return null;

  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Pending business reviews", value: stats.pendingBusinesses, href: "/supaadmin/businesses", highlight: stats.pendingBusinesses > 0 },
    { label: "Total stores", value: stats.totalStores },
    { label: "Total orders", value: stats.totalOrders },
    { label: "Banned users", value: stats.bannedUsers },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Platform overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Card = (
            <div
              className={`rounded-lg border bg-background p-4 ${c.highlight ? "border-primary" : ""}`}
            >
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold">{c.value}</p>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>
              {Card}
            </Link>
          ) : (
            <div key={c.label}>{Card}</div>
          );
        })}
      </div>

      {stats.pendingBusinesses > 0 && (
        <div className="mt-6 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
          You have <strong>{stats.pendingBusinesses}</strong> business verification{" "}
          {stats.pendingBusinesses === 1 ? "request" : "requests"} waiting for review.{" "}
          <Link href="/supaadmin/businesses" className="font-medium text-primary hover:underline">
            Review now →
          </Link>
        </div>
      )}
    </div>
  );
}
