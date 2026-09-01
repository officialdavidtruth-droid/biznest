import { getAdminBadgeCounts } from "@/lib/actions/admin";
import { SupaAdminMobileShell } from "@/components/dashboard/supaadmin-mobile-shell";
import { ThemeProvider, ThemeFlashGuard } from "@/components/theme/theme-provider";

// Auth for everything under /supaadmin is enforced in middleware.ts via the
// ADMIN_PIN cookie, before this layout ever renders — nothing to check here.

export default async function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  const counts = await getAdminBadgeCounts();

  return (
    <>
      <ThemeFlashGuard scopeId="bn-supaadmin-theme-scope" defaultTheme="dark" />
      <ThemeProvider scopeId="bn-supaadmin-theme-scope" defaultTheme="dark">
        {/* h-full (not min-h-screen): min-h-screen is a floor, not a cap, so
            this row grew to fit whatever content was tallest and the sidebar
            + main below never had a bounded height to scroll within -- the
            whole page scrolled instead. h-full resolves against the root
            layout's h-screen body chain (now that ThemeProvider passes height
            through, see theme-provider.tsx) so this row is capped at the
            viewport and its overflow-y-auto children can actually scroll on
            their own. */}
        <div className="flex h-full overflow-hidden" style={{ background: "hsl(var(--background))" }}>
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
      </ThemeProvider>
    </>
  );
}