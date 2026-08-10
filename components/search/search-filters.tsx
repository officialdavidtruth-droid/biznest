import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";
import type { DiscoverySearchParams } from "@/lib/search/businesses";

// Deliberately a plain <form method="get">, not a client component with
// onChange handlers -- every option here just needs to become a URL
// param, and the server component above already re-runs searchBusinesses
// on any param change. No client JS, no hydration cost, and it degrades
// to normal browser navigation if JS is disabled.
export function SearchFilters({ params }: { params: DiscoverySearchParams }) {
  return (
    <form
      method="get"
      action="/search"
      className="bn-card flex flex-wrap items-end gap-3 p-4"
    >
      <div className="flex flex-1 min-w-[180px] flex-col gap-1">
        <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Photographer, plumber, tailor..."
          className="rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex min-w-[160px] flex-col gap-1">
        <label htmlFor="category" className="text-xs font-medium text-muted-foreground">
          Category
        </label>
        <select id="category" name="category" defaultValue={params.category ?? ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All categories</option>
          {ALL_BUSINESS_TYPE_NAMES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[120px] flex-col gap-1">
        <label htmlFor="city" className="text-xs font-medium text-muted-foreground">
          City
        </label>
        <input id="city" name="city" defaultValue={params.city ?? ""} className="rounded-md border px-3 py-2 text-sm" />
      </div>

      <div className="flex min-w-[120px] flex-col gap-1">
        <label htmlFor="state" className="text-xs font-medium text-muted-foreground">
          State
        </label>
        <input id="state" name="state" defaultValue={params.state ?? ""} className="rounded-md border px-3 py-2 text-sm" />
      </div>

      <div className="flex min-w-[150px] flex-col gap-1">
        <label htmlFor="minTrustScore" className="text-xs font-medium text-muted-foreground">
          Min Trust Score
        </label>
        <select
          id="minTrustScore"
          name="minTrustScore"
          defaultValue={params.minTrustScore?.toString() ?? ""}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Any</option>
          <option value="40">40+</option>
          <option value="60">60+</option>
          <option value="80">80+</option>
        </select>
      </div>

      <div className="flex min-w-[150px] flex-col gap-1">
        <label htmlFor="sort" className="text-xs font-medium text-muted-foreground">
          Sort by
        </label>
        <select id="sort" name="sort" defaultValue={params.sort ?? "relevance"} className="rounded-md border px-3 py-2 text-sm">
          <option value="relevance">Relevance</option>
          <option value="trustScore">Trust Score</option>
          <option value="rating">Rating</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="verifiedOnly" value="1" defaultChecked={!!params.verifiedOnly} className="h-4 w-4 rounded border" />
        Verified only
      </label>

      <button type="submit" className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
        Search
      </button>
    </form>
  );
}
