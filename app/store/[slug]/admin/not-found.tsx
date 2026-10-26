// Dashboard-specific 404. Without this file, any notFound() thrown from an admin
// page (an order, booking, product... that doesn't exist) bubbled up to the
// storefront's app/store/[slug]/not-found.tsx and showed "Store not found" --
// wrong message, and storefront styling, inside the owner's dashboard. Because
// this sits below admin/layout.tsx, the sidebar and top bar stay in place.
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-4xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold text-foreground">We couldn&apos;t find that record</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        It may have been deleted, or the link is out of date. Use the menu to get back to your dashboard.
      </p>
    </div>
  );
}
