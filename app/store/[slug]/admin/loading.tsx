// Shown the instant a user clicks any link into a storefront page — hero
// nav links, catalog cards, room links, footer links, etc — for EVERY
// template (Grand Vere, hotel, Nova, Heenzy, all of them), since they all
// render under this one route segment (/store/[slug]/**). Without this
// file, Next.js had no Suspense boundary here, so a click just sat there
// doing nothing visible until the new page's server-side data fetch
// finished — which is exactly what read as "unresponsive."
//
// Can't know the store's own theme colors here (this renders before any
// data loads), so this stays neutral and template-agnostic:
//   1. A slim progress bar fixed to the very top of the viewport — fires
//      immediately on click, independent of any template's layout, so it
//      never looks broken sitting on top of a hero image, a light theme,
//      or a dark one.
//   2. A centered spinner using the same jade token as the platform's own
//      root loading.tsx, so the two loading states feel like one system.
export default function StorefrontLoading() {
  return (
    <>
      <div className="bn-store-progress" role="status" aria-label="Loading" />
      <div className="flex min-h-[70vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--bn-jade)", borderTopColor: "transparent" }}
          aria-hidden="true"
        />
      </div>
      <style>{`
        .bn-store-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--bn-jade, #10967a), transparent);
          background-size: 200% 100%;
          animation: bn-store-progress-sweep 1.1s ease-in-out infinite;
          z-index: 9999;
        }
        @keyframes bn-store-progress-sweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}
