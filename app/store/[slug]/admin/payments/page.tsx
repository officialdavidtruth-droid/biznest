import { prisma } from "@/lib/prisma";

export default async function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const paystackConnected = Boolean(store.paystackSubaccountCode);
  const flutterwaveConnected = Boolean(store.flutterwaveSubaccountId);

  const [paidCount, paidTotal] = await Promise.all([
    prisma.order.count({ where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } } }),
    prisma.order.aggregate({
      where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
      _sum: { total: true, commission: true },
    }),
  ]);

  const gross = Number(paidTotal._sum.total ?? 0);
  const commission = Number(paidTotal._sum.commission ?? 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Payments</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Paystack</p>
            <span className={`rounded-full px-2 py-0.5 text-xs ${paystackConnected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
              {paystackConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {paystackConnected
              ? `Subaccount ${store.paystackSubaccountCode} — sales settle here automatically.`
              : "Connect your bank account to receive payments directly. No API keys required from you."}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Flutterwave</p>
            <span className={`rounded-full px-2 py-0.5 text-xs ${flutterwaveConnected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
              {flutterwaveConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {flutterwaveConnected ? `Subaccount ${store.flutterwaveSubaccountId} active.` : "Optional alternate payout rail."}
          </p>
        </div>
      </div>
    </div>
  );
}
