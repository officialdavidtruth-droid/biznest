import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

export function CategoriesSidebarCard({
  storeSlug,
  title,
  description,
  categories,
  totalCount,
}: {
  storeSlug: string;
  title: string;
  description: string;
  categories: { id: string; name: string; count: number }[];
  totalCount: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted/50">
          <span>All Categories</span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{totalCount}</span>
        </div>
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
            <span className="truncate">{c.name}</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.count}</span>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No categories yet.</p>
        )}
      </div>

      <Link
        href={`/${storeSlug}/admin/categories`}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted/50"
      >
        <Plus className="h-4 w-4" /> Add Category
      </Link>
    </div>
  );
}

export type QuickAction = { icon: LucideIcon; label: string; note: string; href: string };

export function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold">Quick Actions</h2>
      <div className="mt-4 space-y-1">
        {actions.map((a) => (
          <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <a.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="truncate text-xs text-muted-foreground">{a.note}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
