import type { ReactNode } from "react";

/**
 * Horizontal scroll container for wide tables. The site clips overflow-x on
 * <html>/<body> (see app/globals.css), so a table without its own scroll
 * container becomes unreachable on phones. Wrap every <table> in this.
 *
 * `className` is appended, so callers can add borders/rounding/backgrounds.
 * Pair the table with a min-width (e.g. `min-w-[640px]`) so it scrolls
 * instead of squashing its columns.
 */
export function TableScroll({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`overflow-x-auto${className ? ` ${className}` : ""}`}>{children}</div>;
}
