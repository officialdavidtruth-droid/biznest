"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";

// Shown on individual app pages only (not on the marketplace index itself).
// Client-side so it stays correct across soft navigations, where the server
// layout above it does not re-render.
export function AppsBackBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const marketplace = `/store/${slug}/admin/apps`;
  const p = (pathname ?? "").replace(/\/$/, "");
  if (p === marketplace || p === `/${slug}/admin/apps`) return null;
  return (
    <div className="flex items-center justify-between">
      <Link href={marketplace} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted">
        <ArrowLeft className="h-4 w-4" /> Back to Apps
      </Link>
      <Link href={marketplace} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Store className="h-3.5 w-3.5" /> App Marketplace
      </Link>
    </div>
  );
}
