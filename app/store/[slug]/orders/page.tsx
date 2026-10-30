import { listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoreFooter } from "@/components/storefront/store-footer";
import { TasteHouseOrders } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";
import { OrdersListContent } from "./orders-list-content";

export default async function StoreOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) notFound();

  // One lookup for everything this page needs from the store record.
  const record = await prisma.store.findUnique({
    where: { slug },
    select: { template: { select: { name: true } }, business: { select: { sellsProducts: true } } },
  });
  const templateName = record?.template?.name ?? null;
  const copy = getAccountCopy(undefined, store.businessCategory);

  if (templateName === TASTEHOUSE_TEMPLATE_NAME) {
    const themedOrders = await listOrdersForBuyerAtStore(slug);
    return <TasteHouseOrders store={{ ...store, sellsProducts: record?.business?.sellsProducts ?? true }} slug={slug} orders={themedOrders} />;
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
