"use client";

import { usePathname } from "next/navigation";

// Shown for any missing page under a store. The store itself exists (its layout rendered), so say the page is
// missing and send people back to that store's home, not to BizNest.
export default function StoreNotFound() {
  const pathname = usePathname() ?? "/";
  const match = pathname.match(/^\/store\/[^/]+/);
  const home = match ? match[0] : "/";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-4xl font-bold" style={{ color: "var(--bn-jade)" }}>
        404
      </p>
      <h1 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
        Page not found
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        This page isn't available on this store. Try the store's home page.
      </p>
      <a
        href={home}
        className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--bn-jade)" }}
      >
        Back to store
      </a>
    </div>
  );
}
