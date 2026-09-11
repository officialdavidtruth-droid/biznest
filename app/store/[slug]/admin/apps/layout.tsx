import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

export default async function AppsLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="space-y-5">
    <div className="flex items-center justify-between">
      <Link href={`/store/${slug}/admin/apps`} className="inline-flex items-center gap-2 rounded-xl border bg-background px-3.5 py-2 text-sm font-semibold shadow-sm hover:bg-muted">
        <ArrowLeft className="h-4 w-4" /> Back to Apps
      </Link>
      <Link href={`/store/${slug}/admin/apps`} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Store className="h-3.5 w-3.5" /> App Marketplace
      </Link>
    </div>
    {children}
  </div>;
}
