import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileDashboardChrome } from "@/components/dashboard/mobile-dashboard-chrome";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { listMyNotifications } from "@/lib/actions/notifications";

export default async function StoreAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin`);

  const [store, { notifications, unreadCount }] = await Promise.all([
    prisma.store.findUnique({ where: { slug }, include: { business: true } }),
    listMyNotifications(),
  ]);

  if (!store) notFound();

  const isOwner = store.business.userId === session.user.id;
  const isPlatformStaff = ["PLATFORM_ADMIN", "SUPPORT_MODERATOR"].includes(session.user.role);

  if (!isOwner && !isPlatformStaff) {
    redirect("/");
  }

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground lg:flex-row">
      <DashboardSidebar
        slug={slug}
        storeName={store.name}
        sellsProducts={store.business.sellsProducts}
        offersServices={store.business.offersServices}
        category={store.business.category}
      />

      {/* Mobile top bar + fixed bottom tab bar + drawer — see component for
          why this doesn't wrap {children} itself. */}
      <MobileDashboardChrome
        slug={slug}
        storeName={store.name}
        sellsProducts={store.business.sellsProducts}
        offersServices={store.business.offersServices}
        category={store.business.category}
        notifications={notifications}
        unreadCount={unreadCount}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Desktop-only top bar, just for the bell — mobile gets its own in
            MobileDashboardChrome above. */}
        <div className="hidden shrink-0 items-center justify-end border-b border-border px-6 py-3 lg:flex">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        </div>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
