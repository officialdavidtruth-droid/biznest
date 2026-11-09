import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminBadgeCounts } from "@/lib/actions/admin";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { SupaAdminMobileShell } from "@/components/dashboard/supaadmin-mobile-shell";
import { ThemeProvider, ThemeFlashGuard } from "@/components/theme/theme-provider";

// Auth for everything under /supaadmin is enforced in middleware.ts via the
// ADMIN_PIN cookie, before this layout ever renders — nothing to check here.

// SupaAdmin installs as its own app, so it overrides the root layout's manifest
// and icons. Never indexed.
export const metadata: Metadata = {
  title: "SupaAdmin — BizNest Platform",
  manifest: "/supaadmin/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/supaadmin/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/supaadmin/pwa/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "SupaAdmin", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" },
};

// viewport-fit=cover lets the app draw under the notch/home bar when installed;
// the shell pads itself with env(safe-area-inset-*).
export const viewport: Viewport = {
  themeColor: "#07180f",
  viewportFit: "cover",
};

export default async function SupaAdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware only checks the cookie's signature/expiry; this also honours "Sign out" (revoked session).
  // Skip the login page itself (it renders inside this layout) to avoid a redirect loop.
  const onLogin = (await headers()).get("x-bn-pathname") === "/supaadmin/login";
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!onLogin && token && !(await verifyAdminSession(token))) redirect("/supaadmin/login");
  // The sign-in page stands alone: no sidebar (it would show the admin menu to anyone who finds the URL)
  // and no badge-count queries for a visitor who has not signed in.
  if (onLogin) {
    return (
      <>
        <ThemeFlashGuard scopeId="bn-supaadmin-theme-scope" defaultTheme="dark" />
        <ThemeProvider scopeId="bn-supaadmin-theme-scope" defaultTheme="dark">
          <div className="flex min-h-0 flex-1 overflow-y-auto" style={{ background: "hsl(var(--background))" }}>
            <div className="w-full">{children}</div>
          </div>
        </ThemeProvider>
      </>
    );
  }

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