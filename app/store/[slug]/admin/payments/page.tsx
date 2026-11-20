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

  const tile = "rounded-2xl border bg-background p-4 shadow-sm";
  const sectionH = "mb-1 text-base font-semibold";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Payments</h1>
        <a href={`/store/${slug}/admin/receipts?type=payments`} className="rounded-full border bg-background px-4 py-2 text-xs font-semibold text-primary hover:bg-muted">
          Print payment receipts
        </a>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className={`${tile} col-span-2`}>
          <p className="text-xs text-muted-foreground">Total sales</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(gross)}</p>
          <p className="mt-1 text-xs text-muted-foreground">From {paidCount} paid order{paidCount === 1 ? "" : "s"}</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted-foreground">BizNest fee</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{money(commission)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Taken from online sales, based on your plan</p>
        </div>
        <PosCommissionCard slug={slug} balance={posCommission} />
      </div>

      <section className="mt-8">
        <h2 className={sectionH}>Where your money goes</h2>
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
            <p className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">Only the store owner can change the payout account.</p>
          )}
        </div>
      </section>

      <PendingTransfersList slug={slug} transfers={pendingTransfers} />

      <div className="mt-8">
        <CustomerPaymentMessage storeName={store.name} />
      </div>

      {ownGateway && (
        <section className="mt-8">
          <h2 className={sectionH}>Your own payment gateway <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
          <p className="mb-3 max-w-xl text-sm text-muted-foreground">Add your own Paystack or Flutterwave keys to take card payments straight into your gateway account. While this is on, customers pay into your gateway account instead of through BizNest, and BizNest does not pay you out.</p>
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
