// Shown by Next.js while any storefront page under /store/[slug] is
// server-rendering. Without this file the platform's root loading screen
// (the animated BizNest logo) leaked onto every store, which is the wrong
// brand for a merchant's customers. A plain neutral circular spinner works on
// both light and dark storefront templates; the admin area keeps its own
// loading.tsx, which takes precedence over this one.
export default function StoreLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading" data-store-loading>
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-current border-t-transparent opacity-30" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
