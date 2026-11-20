import Link from "next/link";
import type { ReactNode } from "react";

/** One friendly "nothing here yet" block: what this is, and the next thing to do. */
export function EmptyState({
  title,
  hint,
  actionLabel,
  actionHref,
  icon,
  compact,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-dashed bg-background text-center ${compact ? "px-4 py-6" : "px-4 py-10"}`}>
      {icon && <div className="mx-auto mb-2 flex justify-center text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-3 inline-block rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
