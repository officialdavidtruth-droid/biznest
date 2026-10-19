import Link from "next/link";
import { getPayoutCounts, listPayouts, type PayoutTab } from "@/lib/actions/admin-payouts";
import { PayoutRowActions } from "@/components/dashboard/payout-row-actions";

export const dynamic = "force-dynamic";

const TABS: { label: string; value: PayoutTab }[] = [
  { label: "Needs attention", value: "NEEDS_ATTENTION" },
  { label: "Queued", value: "QUEUED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Paid", value: "PAID" },
  { label: "All", value: "ALL" },
];

const STATUS_STYLE: Record<string, string> = {
  FAILED: "bg-red-100 text-red-700",
  REVERSED: "bg-red-100 text-red-700",
  QUEUED: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const activeTab: PayoutTab = TABS.some((t) => t.value === status) ? (status as PayoutTab) : "NEEDS_ATTENTION";

  const [payouts, counts] = await Promise.all([listPayouts(activeTab), getPayoutCounts()]);
  if (!payouts || !counts) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  const badge: Partial<Record<PayoutTab, number>> = {
    NEEDS_ATTENTION: counts.needsAttention,
    QUEUED: counts.queued,
    PROCESSING: counts.processing,
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Vendor payouts</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Money owed to stores. Failed and reversed payouts stay here until someone retries or settles them.
      </p>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/supaadmin/payouts?status=${t.value}`}
            className={`whitespace-nowrap px-3 py-2 text-sm ${
              activeTab === t.value ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {badge[t.value] ? <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{badge[t.value]}</span> : null}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Tries</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nothing here.</td>
                </tr>
              )}
              {payouts.map((p) => {
                const open = p.status === "FAILED" || p.status === "REVERSED";
                return (
                  <tr key={p.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.store.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.payment.purpose} · {p.provider}</p>
                    </td>
                    <td className="px-4 py-3">{p.currency} {Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? ""}`}>{p.status}</span>
                    </td>
                    <td className="max-w-[320px] px-4 py-3 text-xs text-muted-foreground">
                      {p.lastError ?? (p.rawPayload && (p.rawPayload as { manual?: boolean }).manual ? "Paid manually" : "—")}
                    </td>
                    <td className="px-4 py-3">{p.attempts}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(p.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {open ? <PayoutRowActions payoutId={p.id} canRetry={p.provider === "PAYSTACK" || p.provider === "WALLET"} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
