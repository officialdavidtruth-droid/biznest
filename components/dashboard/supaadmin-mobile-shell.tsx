"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldAlert } from "lucide-react";
import { SupaAdminSidebarNav } from "@/components/dashboard/supaadmin-sidebar";
import { SupaAdminLogoutButton } from "@/components/dashboard/supaadmin-logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Wraps the supaadmin sidebar so it behaves as a fixed column on desktop
 * (>= lg) and an off-canvas drawer on mobile/tablet — the layout previously
 * hardcoded a permanent 256px sidebar with no way to hide it, which pushed
 * page content off-screen below ~1024px. Sidebar contents themselves
 * (SupaAdminSidebarNav) are unchanged; only how they're shown changes.
 */
export function SupaAdminMobileShell({
  counts,
  children,
}: {
  counts: { pendingBusinesses: number; openDisputes: number };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close the drawer whenever the admin navigates, so it doesn't stay
  // open covering the new page's content.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const attentionCount = counts.pendingBusinesses + counts.openDisputes;

  const sidebarInner = (
    <>
      <div className="flex items-center gap-2.5 border-b px-4 py-4" style={{ borderColor: "hsl(var(--border))" }}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--bn-accent-gradient)", boxShadow: "0 4px 14px rgba(52, 211, 153, 0.3)" }}
        >
          <ShieldAlert size={16} style={{ color: "hsl(var(--primary-foreground))" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight" style={{ color: "hsl(var(--foreground))" }}>
            SupaAdmin
          </p>
          <p className="text-[10px] leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
            BizNest Platform
          </p>
        </div>
        {attentionCount > 0 && (
          <span
            className="bn-pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--bn-marigold)" }}
            title={`${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention`}
          />
        )}
        {/* Close button only shows inside the mobile drawer (parent hides it on lg via lg:hidden below) */}
        <button
          onClick={() => setOpen(false)}
          className="ml-2 shrink-0 rounded-lg p-1.5 lg:hidden"
          style={{ color: "hsl(var(--muted-foreground))" }}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <SupaAdminSidebarNav counts={counts} />

      <div className="border-t p-3" style={{ borderColor: "hsl(var(--border))" }}>
        <SupaAdminLogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: permanent sidebar column */}
      <aside
        className="relative z-10 hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r lg:flex"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.6)" }}
      >
        {sidebarInner}
      </aside>

      {/* Mobile/tablet: off-canvas drawer + backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background))" }}
      >
        {sidebarInner}
      </aside>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:px-6"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background) / 0.7)" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-lg p-1.5 lg:hidden"
              style={{ color: "hsl(var(--foreground))" }}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <p className="truncate text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
              <span className="hidden sm:inline">Platform back office — shared admin session</span>
              <span className="sm:hidden">Back office</span>
            </p>
          </div>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "hsl(var(--primary) / 0.12)", color: "var(--bn-marigold)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bn-marigold)" }} />
            Live
          </span>
          <ThemeToggle />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </>
  );
}