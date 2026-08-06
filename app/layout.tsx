import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart-context";
import { auth } from "@/lib/auth";
import { getMaintenanceSetting, getAnnouncementSetting } from "@/lib/actions/site-settings";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { MaintenanceScreen } from "@/components/site/maintenance-screen";

export const metadata: Metadata = {
  title: "BizNest — Build, Sell, Grow",
  description: "The all-in-one marketplace and website builder for products, services, and bookings.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, maintenance, announcement] = await Promise.all([
    auth(),
    getMaintenanceSetting(),
    getAnnouncementSetting(),
  ]);

  // Platform staff can always get through, so they can turn maintenance
  // mode back off from /supaadmin/settings without locking themselves out.
  const isStaff = session?.user?.role === "PLATFORM_ADMIN" || session?.user?.role === "SUPPORT_MODERATOR";
  const showMaintenance = maintenance.enabled && !isStaff;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
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
      </body>
    </html>
  );
}
