import { getPosCatalog, getPosDailySummary } from "@/lib/actions/pos";
import { PosRegister } from "@/components/dashboard/pos-register";
import { prisma } from "@/lib/prisma";

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [catalog, summary, store] = await Promise.all([
    getPosCatalog(slug),
    getPosDailySummary(slug),
    prisma.store.findUnique({ where: { slug }, include: { subscription: true } }),
  ]);
  const commissionRatePercent = store?.subscription ? Number(store.subscription.commissionRate) : 8;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Ring up an in-person sale.</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{summary.salesCount}</span> sale
            {summary.salesCount === 1 ? "" : "s"} today
          </p>
          <p>
            {summary.currency} {summary.totalAmount.toLocaleString()} today
          </p>
        </div>
      </div>

      <PosRegister slug={slug} catalog={catalog} commissionRatePercent={commissionRatePercent} />
    </div>
  );
}
