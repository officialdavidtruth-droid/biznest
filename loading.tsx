import { SkeletonBrick } from "@/components/ui/skeleton-brick";

// Shown by Next.js while any page under /store/[slug] (catalog, product,
// category, cart, checkout, account, orders, search) is server-rendering —
// covers the "click a link, nothing happens for a second" gap the user
// was seeing on the storefront. No store theme colors are available at
// this level (this renders before the page's own data fetch resolves), so
// this uses a neutral foreground/10 tint that reads fine on both light and
// dark storefront templates rather than trying to match a specific theme.
export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* header bar: logo + nav + cart icon */}
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <SkeletonBrick className="h-8 w-32" />
        <div className="hidden gap-4 sm:flex">
          <SkeletonBrick className="h-4 w-16" />
          <SkeletonBrick className="h-4 w-16" />
        </div>
        <SkeletonBrick className="h-8 w-8 rounded-full" />
      </div>

      {/* page title */}
      <SkeletonBrick className="mb-2 h-7 w-48" />
      <SkeletonBrick className="mb-6 h-4 w-24" />

      {/* product/service card grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <SkeletonBrick className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <SkeletonBrick className="h-3 w-3/4" />
              <SkeletonBrick className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
