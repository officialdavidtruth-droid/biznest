// Route: /store/[slug]/admin/pos
// Standalone Point of Sale — works for any store that sells products/services.
// Restaurants also get their table list (Reservations → Tables) as a picker for dine-in.
import { notFound, redirect } from "next/navigation";
import { Store } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPosCatalog, getPosDailySummary } from "@/lib/actions/pos";
import { PosRegister } from "@/components/dashboard/pos-register";
import { PosOpenTabs } from "@/components/dashboard/pos-open-tabs";
import { getOpenPosTabs } from "@/lib/actions/pos-tabs";
import { getInHouseReservations } from "@/lib/actions/folio";
import { formatNumber } from "@/lib/i18n/locale";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants/commission";
import { planGate } from "@/lib/entitlements/plan-features";
import { PlanUpgradeNotice } from "@/components/dashboard/plan-upgrade-notice";

const FOOD_TYPES = ["Restaurant", "Food & Groceries"];

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const access = await assertStorePermission(slug, "pos");
  if (!access.success) redirect(`/store/${slug}/admin`);
  const gate = await planGate({ slug }, "pos");
  if (!gate.ok) return <PlanUpgradeNotice slug={slug} title="Point of Sale" message={gate.message} />;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, businessType: true },
  });
  if (!store) notFound();

  const isFoodBusiness = FOOD_TYPES.includes(store.businessType);
  const tables = isFoodBusiness
    ? await prisma.fnbTable.findMany({ where: { storeId: store.id, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } })
    : [];

  const [catalog, summary, openTabs, inHouseRooms] = await Promise.all([
    getPosCatalog(slug),
    getPosDailySummary(slug),
    getOpenPosTabs(slug),
    getInHouseReservations(slug),
  ]);
  // Same source of truth createPosSale uses, so the register never shows a
  // commission the server will not record.
  const commissionRatePercent = PLATFORM_COMMISSION_PERCENT;

  return (
    <div className="bn-admin-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bn-admin-orange)] text-white shadow-md shadow-[color-mix(in_srgb,var(--bn-admin-orange)_30%,transparent)]">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Ring up in-person sales. Stock updates automatically.</p>
          </div>
        </div>
        <div className="flex items-stretch divide-x overflow-hidden rounded-2xl border bg-[var(--bn-admin-orange-soft)]/50">
          <div className="px-5 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Sales today</p>
            <p className="text-xl font-bold tabular-nums">{summary.salesCount}</p>
          </div>
          <div className="px-5 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Taken today</p>
            <p className="text-xl font-bold tabular-nums text-[var(--bn-admin-orange)]">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{summary.currency}</span>
              {formatNumber(summary.totalAmount)}
            </p>
          </div>
        </div>
      </div>
      <PosRegister
        slug={slug}
        catalog={catalog}
        commissionRatePercent={commissionRatePercent}
        showOrderType={isFoodBusiness}
        inHouseRooms={inHouseRooms}
        openTabs={openTabs}
        tables={tables}
      />
      {(isFoodBusiness || openTabs.length > 0) && <PosOpenTabs slug={slug} tabs={openTabs} inHouseRooms={inHouseRooms} />}
    </div>
  );
}
