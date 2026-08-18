import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileDashboardChrome } from "@/components/dashboard/mobile-dashboard-chrome";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { listMyNotifications } from "@/lib/actions/notifications";
import { getStoreAccessRole, hasStorePermission } from "@/lib/access/store-access";
import { findNavItemForPath } from "@/lib/constants/dashboard-nav";

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

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (role === null) redirect("/");

  // No free tier — a store isn't usable until it's on a paid plan. Staff
  // (owner-invited or platform) can still get in while unpaid so platform
  // support can investigate, but an unpaid store blocks its own owner and
  // invited staff the same way — see /onboarding/select-plan.
  if (!store.subscriptionId && role !== "PLATFORM_STAFF") {
    redirect(`/onboarding/select-plan?slug=${slug}`);
  }

  // MANAGER/STAFF only get the specific areas they were granted at invite
  // time (see lib/access/staff-permissions.ts). This is the actual
  // enforcement — the sidebar/mobile nav filtering is just so they don't
  // see links to pages they can't use; a staff member typing a URL
  // directly still hits this check.
  let staffPermissions: string[] | null = null;
  if (role === "MANAGER" || role === "STAFF") {
    const membership = await prisma.storeStaff.findFirst({
      where: { storeId: store.id, userId: session.user.id, status: "ACTIVE" },
      select: { permissions: true },
    });
    staffPermissions = membership?.permissions ?? [];

    const subpath = (await headers()).get("x-bn-admin-subpath") ?? "/";
    const navItem = findNavItemForPath(
      { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices, category: store.business.category },
      subpath
    );
    const blocked =
      navItem?.ownerOnly ||
      (navItem?.permission && !hasStorePermission(role, staffPermissions, navItem.permission));
    if (blocked) redirect(`/store/${slug}/admin`);
  }

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground lg:flex-row">
      <DashboardSidebar
        slug={slug}
        storeName={store.name}
        logoUrl={store.logoUrl}
        sellsProducts={store.business.sellsProducts}
        offersServices={store.business.offersServices}
        category={store.business.category}
        staffRole={role}
        staffPermissions={staffPermissions}
      />

      {/* Mobile top bar + fixed bottom tab bar + drawer — see component for
          why this doesn't wrap {children} itself. */}
      <MobileDashboardChrome
        slug={slug}
        storeName={store.name}
        logoUrl={store.logoUrl}
        sellsProducts={store.business.sellsProducts}
        offersServices={store.business.offersServices}
        category={store.business.category}
        notifications={notifications}
        unreadCount={unreadCount}
        staffRole={role}
        staffPermissions={staffPermissions}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Desktop-only top bar — mobile gets its own in MobileDashboardChrome
            above. Shows the current section so the bar isn't just an empty
            strip with a bell floating at the far end. */}
        <div className="hidden shrink-0 items-center justify-between border-b border-border bg-muted/20 px-6 py-3 lg:flex">
          <p className="text-sm font-medium text-muted-foreground">{store.name} admin</p>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        </div>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
