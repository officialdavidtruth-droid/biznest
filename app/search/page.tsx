import Link from "next/link";
import type { Metadata } from "next";
import { searchBusinesses, type DiscoverySearchParams } from "@/lib/search/businesses";
import { SearchFilters } from "@/components/search/search-filters";
import { BusinessResultCard } from "@/components/search/business-result-card";

export const metadata: Metadata = { title: "Search — BizNest" };

const PAGE_SIZE = 20;

function toParams(sp: Record<string, string | string[] | undefined>): DiscoverySearchParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const num = (v: string | string[] | undefined) => {
    const n = Number(one(v));
    return Number.isFinite(n) && one(v) ? n : undefined;
  };
  const sortRaw = one(sp.sort);
  const sort =
    sortRaw === "rating" || sortRaw === "newest" || sortRaw === "trustScore" || sortRaw === "relevance"
      ? sortRaw
      : undefined;

  return {
    q: one(sp.q) || undefined,
    category: one(sp.category) || undefined,
    city: one(sp.city) || undefined,
    state: one(sp.state) || undefined,
    minRating: num(sp.minRating),
    minTrustScore: num(sp.minTrustScore),
    verifiedOnly: one(sp.verifiedOnly) === "1",
    sort,
    page: num(sp.page) ?? 1,
    pageSize: PAGE_SIZE,
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = toParams(sp);
  const { results, total, page, pageSize } = await searchBusinesses(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Preserve every current filter param when building prev/next links,
  // just swap `page`.
  const pageHref = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") usp.set(k, Array.isArray(v) ? v[0] : v);
    }
    usp.set("page", String(p));
    return `/search?${usp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {params.q ? `Results for "${params.q}"` : "Browse businesses"}
        </h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to BizNest
        </Link>
      </div>

      <div className="mb-6">
        <SearchFilters params={params} />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {total.toLocaleString()} business{total === 1 ? "" : "es"} found
      </p>

      {results.length === 0 ? (
        <div className="bn-card flex flex-col items-center gap-2 p-12 text-center">
          <p className="font-medium">No businesses match those filters</p>
          <p className="text-sm text-muted-foreground">Try widening your search — drop a filter or clear the location.</p>
          <Link href="/search" className="mt-2 text-sm font-medium text-primary hover:underline">
            Clear all filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((business) => (
            <BusinessResultCard key={business.id} business={business} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`rounded-md border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`rounded-md border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
