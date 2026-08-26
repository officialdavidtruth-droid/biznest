import { SkeletonBrick } from "@/components/ui/skeleton-brick";

// Shown while any /store/[slug]/admin/* page (products, orders, services,
// settings, etc.) is server-rendering. Deliberately does NOT try to
// duplicate the real DashboardSidebar/MobileDashboardChrome (that layout
// stays mounted across navigations already -- only the {children} content
// area re-renders), so this only needs to fill the main content column
// with a shape that roughly matches a typical admin page: a heading, a
// toolbar, and a list/table.
export default function StoreAdminLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBrick className="h-7 w-40" />
        <SkeletonBrick className="h-9 w-28" />
      </div>

      <div className="flex flex-wrap gap-3">
        <SkeletonBrick className="h-9 w-full sm:w-64" />
        <SkeletonBrick className="h-9 w-28" />
        <SkeletonBrick className="h-9 w-28" />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/40 p-3">
          <SkeletonBrick className="h-3 w-full max-w-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-3 last:border-0">
            <SkeletonBrick className="h-10 w-10 shrink-0 rounded-md" />
            <SkeletonBrick className="h-3 w-1/3" />
            <SkeletonBrick className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
