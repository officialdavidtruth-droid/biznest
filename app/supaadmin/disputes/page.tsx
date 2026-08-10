import Link from "next/link";
import { listDisputes } from "@/lib/actions/admin";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";
import type { DisputeStatus } from "@prisma/client";

const TABS: { label: string; value: DisputeStatus | "ALL" }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Resolved", value: "RESOLVED_BUYER" },
  { label: "Closed", value: "CLOSED" },
  { label: "All", value: "ALL" },
];

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeTab: DisputeStatus | "ALL" = (status as DisputeStatus | "ALL" | undefined) ?? "OPEN";

  // "Resolved" is really two statuses (RESOLVED_BUYER / RESOLVED_SELLER) —
  // fetch both when that tab is active rather than adding a third tab that
  // just duplicates the same underlying case.
  const disputes =
    activeTab === "ALL"
      ? await listDisputes()
      : activeTab === "RESOLVED_BUYER"
      ? [...(await listDisputes("RESOLVED_BUYER")), ...(await listDisputes("RESOLVED_SELLER"))].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
      : await listDisputes(activeTab);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Resolution Center</h1>
      <p className="mb-4 text-sm text-muted-foreground">Disputes raised by buyers or sellers across every store.</p>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "ALL" ? "/supaadmin/disputes?status=ALL" : `/supaadmin/disputes?status=${t.value}`}
            className={`px-3 py-2 text-sm ${
              activeTab === t.value
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Buyer</th>
              <th className="px-4 py-2">Store</th>
              <th className="px-4 py-2">Opened by</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Opened</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">#{d.orderId.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3">{d.order.buyer.name ?? d.order.buyer.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.order.store.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.raisedBy.name ?? d.raisedBy.email}</td>
                <td className="px-4 py-3">{d.order.currency} {Number(d.order.total).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[d.status].bg} ${DISPUTE_STATUS_CONFIG[d.status].text} ${DISPUTE_STATUS_CONFIG[d.status].ring}`}
                  >
                    {DISPUTE_STATUS_CONFIG[d.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/supaadmin/disputes/${d.id}`} className="text-xs font-medium text-primary hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {disputes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
