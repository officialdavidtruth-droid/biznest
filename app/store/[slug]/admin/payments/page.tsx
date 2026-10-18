// Route: /store/[slug]/admin/payments
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayoutStatus } from "@/lib/actions/store";
import { getActiveGateway } from "@/lib/actions/site-settings";
import { ConnectPayoutForm } from "@/components/dashboard/connect-payout-form";
import { getPosCommissionBalance } from "@/lib/actions/pos";
import { PosCommissionCard } from "@/components/dashboard/pos-commission-card";
import { getRefundClawbackBalance, getRefundPendingPayments } from "@/lib/actions/refund";
import { RefundPendingCard } from "@/components/dashboard/refund-pending-card";
import { RefundClawbackCard } from "@/components/dashboard/refund-clawback-card";

export default async function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const payout = await getPayoutStatus(slug);
  if (!payout) return null;
  const gateway = await getActiveGateway();

  const session = await auth();
  const isStaff = session?.user?.role === "PLATFORM_ADMIN" || session?.user?.role === "SUPPORT_MODERATOR";

  const [paidCount, paidTotal, posCommission, refundClawback, refundPending] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } } }),
    prisma.order.aggregate({
      where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
      _sum: { total: true, commission: true },
    }),
    getPosCommissionBalance(slug),
    // Staff-only ledger — see assertStaffAccess in lib/actions/refund.ts.
    // Returns null for a store owner, which RefundClawbackCard treats the
    // same as "nothing owed" and renders nothing.
    isStaff ? getRefundClawbackBalance(slug) : Promise.resolve(null),
    isStaff ? getRefundPendingPayments(slug) : Promise.resolve(null),
  ]);

  const gross = Number(paidTotal._sum.total ?? 0);
  const commission = Number(paidTotal._sum.commission ?? 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Payments</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Gross sales</p>
          <p className="mt-1 text-2xl font-semibold">₦{gross.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Platform commission</p>
          <p className="mt-1 text-2xl font-semibold">₦{commission.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Paid orders</p>
          <p className="mt-1 text-2xl font-semibold">{paidCount}</p>
        </div>
        <PosCommissionCard slug={slug} balance={posCommission} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payout account</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Connect your bank account to get paid. When a customer&apos;s payment is confirmed, the money is sent
        straight to this account — no manual transfers.
      </p>
      <div className="mb-4 rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-4 text-sm text-[var(--bn-admin-orange)]">
        <p className="font-semibold">Inline card checkout enabled</p>
        <p className="mt-1 text-xs leading-5">Customers can pay by Visa, Mastercard or Verve inside the storefront checkout when the active payment provider has its public key configured. Money from your sales is paid out to your connected bank account.</p>
      </div>
      <div className="max-w-md">
        <ConnectPayoutForm
          slug={slug}
          provider={gateway}
          connected={payout.connected}
          needsReconnect={payout.needsReconnect}
          details={payout.payoutDetails}
        />
      </div>

      {refundPending && <div className="mt-6"><RefundPendingCard slug={slug} payments={refundPending} /></div>}

      {refundPending && <div className="mt-6"><RefundPendingCard slug={slug} payments={refundPending} /></div>}

      {refundClawback && (
        <div className="mt-6">
          <RefundClawbackCard slug={slug} balance={refundClawback} />
        </div>
      )}
    </div>
  );
}
