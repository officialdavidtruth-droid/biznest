import { listAwaitingTransferOrdersForBuyer, listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { DISPUTABLE_ORDER_STATUSES } from "@/lib/constants/dispute";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowUpRight, ShoppingBag, ShieldAlert, ArrowLeft, Wallet, Layers } from "lucide-react";
import { StoreFooter } from "@/components/storefront/store-footer";
import { TasteHouseOrders } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { OrdersListContent } from "./orders-list-content";

export default async function StoreOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const record = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  const copy = getAccountCopy(record?.template?.name, store.businessCategory);

  const templateRecord = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } }, business: { select: { sellsProducts: true } }, reviews: { select: { id: true } } } });
  if (templateRecord?.template?.name === TASTEHOUSE_TEMPLATE_NAME) {
    const themedOrders = await listOrdersForBuyerAtStore(slug);
    return <TasteHouseOrders store={{...store,sellsProducts:templateRecord.business?.sellsProducts??true}} slug={slug} orders={themedOrders}/>;
  }
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ---------- STICKY HEADER ---------- */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href={`/store/${slug}/account`}
            aria-label="Back to account"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">My {copy.orders.toLowerCase()}</h1>
            <p className="truncate text-xs text-slate-500">{store.name}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <OrdersListContent slug={slug} />
      </div>
      <StoreFooter store={store} slug={slug} />
    </div>
  );
}
