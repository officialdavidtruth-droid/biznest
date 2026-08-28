import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { getStoreCustomerOverview } from "@/lib/actions/account";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Package, Gift, Calendar } from "lucide-react";

export default async function StoreAccountOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getStoreCustomerSessionForStore(slug);
  const store = await getStoreBranding(slug);
  if (!store) notFound();

  const overview = await getStoreCustomerOverview(slug);
  if (!overview) {
    return <p className="text-sm text-slate-500">Couldn&apos;t load your account overview.</p>;
  }

  const record = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  const copy = getAccountCopy(record?.template?.name, store.businessCategory);
  const addr = overview.defaultAddress;

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-slate-900">Account Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Account details */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Account Details</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-semibold text-slate-900">{session?.user?.name ?? "—"}</p>
            <p className="text-sm text-slate-500">{session?.user?.email}</p>
          </div>
        </div>

        {/* Address book -- only relevant when something physical could ship */}
        {store.sellsProducts && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Address Book</p>
              <Link href={`/store/${slug}/account/addresses`} aria-label="Edit address book">
                <Pencil className="h-3.5 w-3.5 text-amber-500" />
              </Link>
            </div>
            <div className="px-5 py-4 text-sm">
              {addr ? (
                <>
                  <p className="mb-1 text-slate-600">Your default shipping address:</p>
                  <p className="font-semibold text-slate-900">{addr.fullName}</p>
                  <p className="text-slate-500">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}
                  </p>
                  <p className="text-slate-500">{addr.city}, {addr.state}</p>
                  <p className="text-slate-500">{addr.phone}</p>
                </>
              ) : (
                <p className="text-slate-500">
                  No address saved yet.{" "}
                  <Link href={`/store/${slug}/account/addresses`} className="font-medium text-amber-600 hover:underline">
                    Add one
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loyalty points (this store's "store credit" equivalent) */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Loyalty Points</p>
          </div>
          <div className="px-5 py-4">
            <Link href={`/store/${slug}/account/loyalty`} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
              <Gift className="h-4 w-4" />
              Points balance: {overview.pointsBalance}
            </Link>
          </div>
        </div>

        {/* Orders at this store -- only if the store actually sells products */}
        {store.sellsProducts && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{copy.orders} at {store.name}</p>
            </div>
            <div className="px-5 py-4">
              <Link href={`/store/${slug}/account/orders`} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                <Package className="h-4 w-4" />
                {overview.orderCount} {copy.orders.toLowerCase().replace(/s$/, "")}{overview.orderCount === 1 ? "" : "s"} placed — view history
              </Link>
            </div>
          </div>
        )}

        {/* Bookings at this store -- only if the store actually offers services */}
        {store.offersServices && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{copy.bookings} at {store.name}</p>
            </div>
            <div className="px-5 py-4">
              <Link href={`/store/${slug}/account/bookings`} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                <Calendar className="h-4 w-4" />
                {overview.bookingCount} {copy.bookings.toLowerCase().replace(/s$/, "")}{overview.bookingCount === 1 ? "" : "s"} — view history
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
