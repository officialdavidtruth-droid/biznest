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

export const metadata: Metadata = {
  title: "BizNest — Build, Sell, Grow",
  description: "The all-in-one marketplace and website builder for products, services, and bookings.",
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
  themeColor: "#0a1c12",
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
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
        <CartProvider>
          {showMaintenance ? (
            <MaintenanceScreen message={maintenance.message} />
          ) : (
            <>
              {announcement.enabled && announcement.message && (
                <AnnouncementBanner message={announcement.message} tone={announcement.tone} />
              )}
              {children}
            </>
          )}
          <Toaster richColors position="top-center" />
        </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
