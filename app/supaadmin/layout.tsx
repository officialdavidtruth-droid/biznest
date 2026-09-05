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
        {/* flex-1 (not min-h-screen or h-full): min-h-screen is a floor, not
            a cap, so this row grew to fit whatever content was tallest and
            the sidebar + main below never had a bounded height to scroll
            within -- the whole page scrolled instead. flex-1 fills exactly
            whatever height the root layout's flex-1 region actually has
            (banner or not) via flex distribution, not a percentage chain --
            see the comment on this same div in theme-provider.tsx for why
            that distinction matters -- so this row is reliably capped and
            its overflow-y-auto children can actually scroll on their own. */}
        <div className="flex min-h-0 flex-1 overflow-hidden" style={{ background: "hsl(var(--background))" }}>
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