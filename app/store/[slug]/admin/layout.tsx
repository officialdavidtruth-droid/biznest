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
import { ThemeProvider, ThemeFlashGuard } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default async function StoreAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin`);

  const [store, { notifications, unreadCount }] = await Promise.all([
    prisma.store.findUnique({ where: { slug }, include: { business: true, subscription: true } }),
    listMyNotifications(),
  ]);

  if (!store) notFound();

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  const adminSubpath = (await headers()).get("x-bn-admin-subpath") ?? "/";
  const isPmsRoute = adminSubpath === "/pms" || adminSubpath.startsWith("/pms/");
  if (role === null) redirect("/");

  // No free tier — a store isn't usable until it's on a paid plan. Staff
  // (owner-invited or platform) can still get in while unpaid so platform
  // support can investigate, but an unpaid store blocks its own owner and
  // invited staff the same way — see /onboarding/select-plan.
  if (!store.subscriptionId && role !== "PLATFORM_STAFF") {
    redirect(`/onboarding/select-plan?slug=${slug}`);
  }

  if (isPmsRoute && role !== "PLATFORM_STAFF" && store.subscription?.name !== "Business Mogul") {
    redirect(`/${slug}/admin/subscription?pms=upgrade`);
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

    const subpath = adminSubpath;
    const navItem = findNavItemForPath(
      { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices, category: store.businessType, subscriptionName: store.subscription?.name },
      subpath
    );
    const blocked =
      navItem?.ownerOnly ||
      (navItem?.permission && !hasStorePermission(role, staffPermissions, navItem.permission));
    if (blocked) redirect(`/${slug}/admin`);
  }

  if (isPmsRoute) {
    return (
      <>
        <ThemeFlashGuard scopeId="bn-pms-theme-scope" />
        <ThemeProvider scopeId="bn-pms-theme-scope">
          <div className="min-h-full bg-background text-foreground">{children}</div>
        </ThemeProvider>
      </>
    );
  }

  return (
    <>
      <ThemeFlashGuard scopeId="bn-admin-theme-scope" />
      <ThemeProvider scopeId="bn-admin-theme-scope">
        {/* flex-1, not h-screen: the root layout (app/layout.tsx) now wraps
            <body>'s content in a flex column with the AnnouncementBanner as
            a normal block above a flex-1 region. h-screen here ignored the
            banner's height and pushed this whole block -- including the
            fixed mobile bottom bar -- off-screen, so a live announcement
            never actually appeared on the store business dashboard.
            flex-1 fills whatever space that flex-1 region has, banner or
            not -- via flex distribution rather than a percentage (h-full),
            so it doesn't depend on every ancestor between here and <body>
            correctly resolving a percentage height (see the comment on
            this same div in theme-provider.tsx for why that matters). */}
        {/* Plain flex row, sized to its own content — no forced height,
            no overflow-hidden, no independent overflow-y-auto scroll
            region on <main>. The sidebar goes sticky instead (see
            DashboardSidebar), which keeps it in view during scroll
            without needing every ancestor to correctly compute an exact
            "fill the rest of the viewport" height. That fixed-height +
            overflow-y-auto combination was the actual fragile part —
            it depended on this row, the column below, and <main> all
            landing on the exact same height, and any mismatch meant
            either the sidebar or the page's own background showed up
            as dead space. One normal, whole-document scroll can't
            produce that failure mode. */}
        <div className="bn-admin-app flex flex-col bg-background text-foreground lg:flex-row">
          <DashboardSidebar
            slug={slug}
            storeName={store.name}
            logoUrl={store.logoUrl}
            sellsProducts={store.business.sellsProducts}
            offersServices={store.business.offersServices}
            category={store.businessType}
            staffRole={role}
            staffPermissions={staffPermissions}
            subscriptionName={store.subscription?.name}
          />

          {/* Mobile top bar + fixed bottom tab bar + drawer — see component for
              why this doesn't wrap {children} itself. */}
          <MobileDashboardChrome
            slug={slug}
            storeName={store.name}
            logoUrl={store.logoUrl}
            sellsProducts={store.business.sellsProducts}
            offersServices={store.business.offersServices}
            category={store.businessType}
            notifications={notifications}
            unreadCount={unreadCount}
            staffRole={role}
            staffPermissions={staffPermissions}
            staffPosition={session.user.staffPosition}
            subscriptionName={store.subscription?.name}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Desktop-only top bar — mobile gets its own in MobileDashboardChrome
                above. Shows the current section so the bar isn't just an empty
                strip with a bell floating at the far end. */}
            <div className="hidden shrink-0 items-center justify-between border-b border-border bg-muted/20 px-6 py-3 lg:sticky lg:top-0 lg:z-10 lg:flex">
              <p className="text-sm font-medium text-muted-foreground">
                {/* Staff who signed in as "Position@store" get their title
                    in the header, matching what the owner named them at
                    invite time — see StoreStaff.position. Owners (and
                    staff who signed in with their own email) just get the
                    plain store name, same as before. */}
                {session.user.staffPosition
                  ? `${session.user.staffPosition} - ${store.name}`
                  : `${store.name} business`}
              </p>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <NotificationBell notifications={notifications} unreadCount={unreadCount} />
              </div>
            </div>

            <main className="bg-background pb-20 lg:pb-0">
              <div className="mx-auto max-w-none px-4 py-4 lg:px-7 lg:py-7">{children}</div>
            </main>
          </div>
        </div>
      </ThemeProvider>
    </>
  );
}
