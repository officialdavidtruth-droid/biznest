import { getAdminBadgeCounts } from "@/lib/actions/admin";
import { SupaAdminMobileShell } from "@/components/dashboard/supaadmin-mobile-shell";

// Auth for everything under /supaadmin is enforced in middleware.ts via the
// ADMIN_PIN cookie, before this layout ever renders — nothing to check here.

export default async function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  const counts = await getAdminBadgeCounts();

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

      <SupaAdminMobileShell counts={counts}>{children}</SupaAdminMobileShell>
    </div>
  );
}
