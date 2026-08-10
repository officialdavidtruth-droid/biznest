import Link from "next/link";
import { listWishlist } from "@/lib/actions/account";
import { Heart } from "lucide-react";

export default async function WishlistPage() {
  const items = await listWishlist();

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <Heart className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">Nothing saved yet. Tap the heart on any product to save it here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const listing = item.product ?? item.service;
        const store = item.product?.store ?? item.service?.store;
        if (!listing || !store) return null;
        return (
          <Link
            key={item.id}
            href={`/store/${store.slug}`}
            className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-square bg-slate-100">
              {listing.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.images[0]} alt={listing.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-semibold text-slate-900">{listing.name}</div>
              <div className="text-xs text-slate-500">{store.name}</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {listing.currency} {Number(listing.price).toLocaleString()}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
