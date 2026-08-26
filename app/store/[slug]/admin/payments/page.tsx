// Route: /store/[slug]/admin/payments
import { prisma } from "@/lib/prisma";
import { getPayoutStatus } from "@/lib/actions/store";
import { ConnectPayoutForm } from "@/components/dashboard/connect-payout-form";
import { getPosCommissionBalance } from "@/lib/actions/pos";
import { PosCommissionCard } from "@/components/dashboard/pos-commission-card";

export default async function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const payout = await getPayoutStatus(slug);
  if (!payout) return null;

  const [paidCount, paidTotal, posCommission] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } } }),
    prisma.order.aggregate({
      where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
      _sum: { total: true, commission: true },
    }),
    getPosCommissionBalance(slug),
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
        Connect at least one to get paid. Sales automatically split — your {(100 - payout.commissionRate).toFixed(1)}% goes straight to
        your bank, ours to the platform. No manual transfers.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ConnectPayoutForm
          slug={slug}
          provider="PAYSTACK"
          connected={payout.paystackConnected}
          details={payout.payoutDetails?.provider === "PAYSTACK" ? payout.payoutDetails : null}
          commissionRate={payout.commissionRate}
        />
        <ConnectPayoutForm
          slug={slug}
          provider="FLUTTERWAVE"
          connected={payout.flutterwaveConnected}
          details={payout.payoutDetails?.provider === "FLUTTERWAVE" ? payout.payoutDetails : null}
          commissionRate={payout.commissionRate}
        />
      </div>
    </div>
  );
}
