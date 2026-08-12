import { ShieldAlert } from "lucide-react";
import { SupaAdminLogoutButton } from "@/components/dashboard/supaadmin-logout-button";
import { SupaAdminSidebarNav } from "@/components/dashboard/supaadmin-sidebar";
import { getAdminBadgeCounts } from "@/lib/actions/admin";

// Auth for everything under /supaadmin is enforced in middleware.ts via the
// ADMIN_PIN cookie, before this layout ever renders — nothing to check here.

export default async function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  const counts = await getAdminBadgeCounts();
  const attentionCount = counts.pendingBusinesses + counts.openDisputes;

  return (
    <div className="dark flex min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Ambient forest glow behind the whole shell, matching the marketing
          surfaces' .bn-gradient-dark treatment so the back office reads as
          the same product, not a bolted-on admin template. */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(80% 60% at 0% 0%, rgba(52, 211, 153, 0.07) 0%, transparent 55%), hsl(var(--background))",
        }}
      />

      <aside
        className="relative z-10 flex w-64 shrink-0 flex-col border-r"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.6)" }}
      >
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
        </div>

        <SupaAdminSidebarNav counts={counts} />

        <div className="border-t p-3" style={{ borderColor: "hsl(var(--border))" }}>
          <SupaAdminLogoutButton />
        </div>
      </aside>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between border-b px-6 py-3 backdrop-blur"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background) / 0.7)" }}
        >
          <p className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
            Platform back office — shared admin session
          </p>
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "hsl(var(--primary) / 0.12)", color: "var(--bn-marigold)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bn-marigold)" }} />
            Live
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
