import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { TrustBadge } from "@/components/storefront/trust-badge";

export type SearchResultBusiness = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  avgRating: number | null;
  reviewCount: number;
  verificationBadge: boolean;
  trustScore: number | null;
  store: {
    slug: string;
    name: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    products: { name: string; price: unknown; currency: string; images: string[] }[];
    services: { name: string; price: unknown; currency: string; images: string[] }[];
  } | null;
};

type CatalogPreviewItem = { name: string; price: unknown; currency: string; images: string[] };

function formatFrom(items: CatalogPreviewItem[]) {
  if (items.length === 0) return null;
  const prices = items.map((i) => Number(i.price)).filter((p) => Number.isFinite(p));
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const currency = items[0].currency;
  return `From ${currency} ${min.toLocaleString()}`;
}

export function BusinessResultCard({ business }: { business: SearchResultBusiness }) {
  const { store } = business;
  // Businesses without a live store yet (e.g. still onboarding) have
  // nothing to link to -- searchVisible defaults true independent of
  // store existing, so this guard keeps them out of results without
  // touching the query itself.
  if (!store) return null;

  const catalogPreview = [...store.products, ...store.services];
  const priceFrom = formatFrom(catalogPreview);
  const image = store.bannerUrl || store.logoUrl;

  return (
    <Link
      href={`/${store.slug}`}
      className="bn-card group flex flex-col overflow-hidden transition hover:shadow-md"
    >
      <div className="relative h-36 w-full overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={store.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
            {store.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        {business.verificationBadge && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-semibold text-primary">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{store.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{business.category}</p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {business.city}, {business.state}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {business.avgRating != null && (
            <span className="flex items-center gap-1 text-xs font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {business.avgRating.toFixed(1)}
              <span className="text-muted-foreground">({business.reviewCount})</span>
            </span>
          )}
          <TrustBadge score={business.trustScore} size="sm" />
        </div>

        {priceFrom && <p className="mt-auto pt-2 text-sm font-semibold text-primary">{priceFrom}</p>}
      </div>
    </Link>
  );
}
