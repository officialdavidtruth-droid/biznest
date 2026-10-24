// Route: /store/[slug]/admin/pos
// Standalone Point of Sale — works for any store that sells products/services.
// Only restaurants/food stores with the FnB plugin installed use the FnB
// workspace's POS tab instead (shifts + kitchen display), and the sidebar
// already hides this link for them, so we forward them there.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPosCatalog, getPosDailySummary } from "@/lib/actions/pos";
import { PosRegister } from "@/components/dashboard/pos-register";

const FOOD_TYPES = ["Restaurant", "Food & Groceries"];

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const access = await assertStorePermission(slug, "pos");
  if (!access.success) redirect(`/store/${slug}/admin`);

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, businessType: true, subscription: { select: { commissionRate: true } } },
  });
  if (!store) notFound();

  const isFoodBusiness = FOOD_TYPES.includes(store.businessType);
  if (isFoodBusiness) {
    const fnb = await getPluginEntitlement(store.id, "fnb-operations");
    if (fnb.allowed && fnb.installed) redirect(`/store/${slug}/admin/fnb`);
  }

  const [catalog, summary] = await Promise.all([getPosCatalog(slug), getPosDailySummary(slug)]);
  const commissionRatePercent = store.subscription ? Number(store.subscription.commissionRate) : 8;

  return (
    <div className="bn-admin-page space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ring up in-person sales. Stock updates automatically.</p>
        </div>
        <div className="rounded-xl border px-4 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today</p>
          <p className="text-sm font-semibold">
            {summary.salesCount} {summary.salesCount === 1 ? "sale" : "sales"} · {summary.currency}{" "}
            {summary.totalAmount.toLocaleString()}
          </p>
        </div>
      </div>
      <PosRegister slug={slug} catalog={catalog} commissionRatePercent={commissionRatePercent} showOrderType={isFoodBusiness} />
    </div>
  );
}
