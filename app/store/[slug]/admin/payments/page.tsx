// Route: /store/[slug]/admin/payments
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayoutStatus } from "@/lib/actions/store";
import { getOwnGatewaySettings } from "@/lib/actions/store-gateway";
import { OwnGatewayForm } from "@/components/dashboard/own-gateway-form";
import { ManualPaymentSettingsForm } from "@/components/dashboard/manual-payment-settings-form";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { manualPayInfoFromStore } from "@/lib/payments/manual-transfer";
import { getPosCommissionBalance } from "@/lib/actions/pos";
import { PosCommissionCard } from "@/components/dashboard/pos-commission-card";
import { getRefundClawbackBalance, getRefundPendingPayments } from "@/lib/actions/refund";
import { RefundPendingCard } from "@/components/dashboard/refund-pending-card";
import { RefundClawbackCard } from "@/components/dashboard/refund-clawback-card";
import { moneyFormatter } from "@/lib/utils/format-money";

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
  const manual = manualPayInfoFromStore(store);
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bank transfer</h2>
      <p className="mb-3 max-w-xl text-sm text-muted-foreground">
        Customers pay you directly: they see your account details at checkout, transfer the money, and upload a screenshot of the payment.
        You confirm each payment once it reaches your account. BizNest never holds your money.
      </p>
      <ManualPaymentSettingsForm
        slug={slug}
        canEdit={canEditPayments}
        initial={{
          enabled: manual.enabled,
          bankName: store.manualBankName ?? "",
          accountName: store.manualAccountName ?? "",
          accountNumber: store.manualAccountNumber ?? "",
          note: store.manualPayNote ?? "",
          whatsapp: manual.whatsapp ? `+${manual.whatsapp}` : "",
          // The call line is the store's contact phone.
          call: manual.call ? `+${manual.call}` : "",
        }}
      />

      {ownGateway && (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your own payment gateway (optional)</h2>
          <p className="mb-3 max-w-xl text-sm text-muted-foreground">Add your own Paystack or Flutterwave keys to take card payments straight into your gateway account. While switched on, checkout uses your gateway instead of bank transfer.</p>
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