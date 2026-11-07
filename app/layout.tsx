import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart-context";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { getMaintenanceSetting, getAnnouncementSetting } from "@/lib/actions/site-settings";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { MaintenanceScreen } from "@/components/site/maintenance-screen";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { PagePulse } from "@/components/site/page-pulse";
import { InstallAppPrompt } from "@/components/site/install-app-prompt";
import { AppShell } from "@/components/app/app-shell";
import { Suspense } from "react";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  // Lets every relative OG/Twitter image and alternate URL resolve to an
  // absolute one. Pages on a vendor's custom domain set their own absolute
  // canonical/image URLs (see lib/seo.ts).
  metadataBase: new URL(SITE_URL),
  title: "BizNest — Build, Sell, Grow",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // Deliberately NO root-level `alternates.canonical`: it would be inherited
  // by every page that doesn't set its own and tell Google they all
  // duplicate the homepage. The homepage sets its own canonical.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    title: "BizNest — Build, Sell, Grow",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "BizNest — Build, Sell, Grow",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  // Set these in your environment after adding the site in Google Search
  // Console / Bing Webmaster Tools (HTML-tag method) -- see .env.example.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f6410",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, maintenance, announcement, cookieStore, headerList] = await Promise.all([
    auth(),
    getMaintenanceSetting(),
    getAnnouncementSetting(),
    cookies(),
    headers(),
  ]);
  const isPinAdmin = await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  // Platform staff can always get through, so they can turn maintenance
  // mode back off from /supaadmin/settings without locking themselves out.
  // Three ways to qualify: the legacy user-role flag (still used for a
  // couple of other override checks elsewhere in the app), a valid PIN
  // cookie, or — for /supaadmin/login itself, where there's no cookie yet —
  // the header middleware sets for that whole path. Without that third
  // check, turning maintenance mode on would make it impossible to ever
  // log in to turn it back off.
  const isStaff =
    session?.user?.role === "PLATFORM_ADMIN" ||
    session?.user?.role === "SUPPORT_MODERATOR" ||
    isPinAdmin ||
    headerList.get("x-bn-skip-maintenance") === "1";
  const showMaintenance = maintenance.enabled && !isStaff;

  return (
    <html lang="en" {...(headerList.get("user-agent")?.includes("BizNestApp") ? { "data-app": "1" } : {})}>
      <body className="flex min-h-screen flex-col bg-background font-sans antialiased">
        <SessionProvider>
        <CartProvider>
          {showMaintenance ? (
            <MaintenanceScreen message={maintenance.message} />
          ) : (
            <>
              {announcement.enabled && announcement.message && (
                <AnnouncementBanner message={announcement.message} tone={announcement.tone} />
              )}
              {/* flex-1 + min-h-0: takes whatever height is left after the
                  banner (or all of it, if there's no banner) instead of
                  every page having to independently account for the
                  banner's height. Pages that just want normal document flow
                  (most of them) still get it -- this div only constrains
                  height, it doesn't force overflow-hidden -- while pages
                  with their own fixed-height app-shell (e.g. store admin,
                  h-full) now measure against this region instead of the
                  full viewport. min-h-0 is required so the flex item can
                  actually shrink below its content size instead of
                  overflowing past the banner like h-screen used to. */}
              {/* flex-1 + min-h-0: takes whatever height is left after the
                  banner (or all of it, if there's no banner). Store
                  admin/supaadmin measure their own shell against this
                  region (see theme-provider.tsx); ordinary pages (like
                  onboarding) ignore it entirely and just render at their
                  own natural content height. */}
              <div id="bn-app-content" className="flex min-h-0 flex-1 flex-col">{children}</div>
            </>
          )}
          <Suspense fallback={null}><AppShell /></Suspense>
          <PagePulse />
          <InstallAppPrompt />
          <Toaster richColors position="top-center" />
        </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
