// Route: /store/[slug]/admin/payments
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayoutStatus } from "@/lib/actions/store";
import { getOwnGatewaySettings } from "@/lib/actions/store-gateway";
import { OwnGatewayForm } from "@/components/dashboard/own-gateway-form";
import { ConnectPayoutForm } from "@/components/dashboard/connect-payout-form";
import { getActiveGateway } from "@/lib/payments/gateway";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPosCommissionBalance } from "@/lib/actions/pos";
import { PosCommissionCard } from "@/components/dashboard/pos-commission-card";
import { getRefundClawbackBalance, getRefundPendingPayments } from "@/lib/actions/refund";
import { RefundPendingCard } from "@/components/dashboard/refund-pending-card";
import { RefundClawbackCard } from "@/components/dashboard/refund-clawback-card";
import { moneyFormatter } from "@/lib/utils/format-money";
import { getPendingTransfers } from "@/lib/actions/manual-payment";
import { CustomerPaymentMessage } from "@/components/dashboard/customer-payment-message";
import { PendingTransfersList } from "@/components/dashboard/pending-transfers-list";

export default async function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  const money = moneyFormatter(store);
  if (!store) return null;

  // Owner-only gate: getPayoutStatus returns null for anyone but the store owner.
  // (The legacy payout account card is hidden for now; only the own-gateway form remains.)
  const payout = await getPayoutStatus(slug);
  if (!payout) return null;
  // Owner-only: null for staff, who must not see or change the store's payment keys.
  const ownGateway = await getOwnGatewaySettings(slug);

  const canEditPayments = (await assertStorePermission(slug, "payments")).success;
  // The account name is verified with the gateway picked in SupaAdmin, the same one that pays the store out.
  const activeGateway = await getActiveGateway();
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

  const pendingTransfers = await getPendingTransfers(slug);
  const gross = Number(paidTotal._sum.total ?? 0);
  const commission = Number(paidTotal._sum.commission ?? 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Payments</h1>
        <a href={`/${slug}/admin/receipts?type=payments`} className="text-sm font-medium text-primary hover:underline">
          Print payment receipts →
        </a>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Gross sales</p>
          <p className="mt-1 text-2xl font-semibold">{money(gross)}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Platform commission</p>
          <p className="mt-1 text-2xl font-semibold">{money(commission)}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Paid orders</p>
          <p className="mt-1 text-2xl font-semibold">{paidCount}</p>
        </div>
        <PosCommissionCard slug={slug} balance={posCommission} />
      </div>

      <CustomerPaymentMessage storeName={store.name} />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payout account</h2>
      <p className="mb-3 max-w-xl text-sm text-muted-foreground">
        Customers pay at checkout by card, bank transfer or USSD. Once a payment is confirmed, the money is sent to the bank account you connect here.
      </p>
      <div className="max-w-xl">
        {canEditPayments ? (
          <ConnectPayoutForm
            slug={slug}
            provider={activeGateway}
            connected={payout.connected}
            needsReconnect={payout.needsReconnect}
            details={payout.payoutDetails}
          />
        ) : (
          <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Only the store owner can change the payout account.</p>
        )}
      </div>

      <PendingTransfersList slug={slug} transfers={pendingTransfers} />

      {ownGateway && (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your own payment gateway (optional)</h2>
          <p className="mb-3 max-w-xl text-sm text-muted-foreground">Add your own Paystack or Flutterwave keys to take card payments straight into your gateway account. While switched on, customers pay into your own gateway account instead of through BizNest, and BizNest does not pay you out.</p>
          <OwnGatewayForm slug={slug} settings={ownGateway} />
        </section>
      )}

      {refundPending && <div className="mt-6"><RefundPendingCard slug={slug} payments={refundPending} /></div>}

      {refundClawback && (
        <div className="mt-6">
          <RefundClawbackCard slug={slug} balance={refundClawback} />
        </div>
      )}
    </div>
  );
}