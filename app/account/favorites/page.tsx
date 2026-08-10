import Link from "next/link";
import { listFavoriteBusinesses } from "@/lib/actions/account";
import { Store, ShieldCheck } from "lucide-react";

export default async function FavoriteBusinessesPage() {
  const favorites = await listFavoriteBusinesses();

  if (favorites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <Store className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No favorite businesses yet. Follow a store to see it here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {favorites.map(({ id, business }) => {
        if (!business.store) return null;
        return (
          <Link
            key={id}
            href={`/store/${business.store.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">
              {business.store.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.store.logoUrl} alt={business.businessName} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 truncate text-sm font-semibold text-slate-900">
                {business.businessName}
                {business.verificationBadge && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
              </div>
              <div className="truncate text-xs text-slate-500">
                {business.category} · {business.city}, {business.state}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
