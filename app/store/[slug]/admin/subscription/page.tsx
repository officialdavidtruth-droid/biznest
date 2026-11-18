// Route: /store/[slug]/admin/subscription
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import { SubscriptionPlans } from "@/components/dashboard/subscription-plans";
import { formatDate } from "@/lib/i18n/locale";

export default async function SubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ upgraded?: string; payment?: string; pms?: string; apps?: string }>;
}) {
  const { slug } = await params;
  const { upgraded, payment, pms, apps } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, business: true } });
  if (!store) return null;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/subscription`);
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) redirect(`/${slug}/admin`);

  // isMarketingPlan: false -- this store already isn't marketingOnly (see
  // the layout redirect above), so the two BizNest Marketing tiers have no
  // business appearing on its upgrade screen.
  const plans = await prisma.subscription.findMany({ where: { isActive: true, isMarketingPlan: false }, orderBy: { price: "asc" } });

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Subscription</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Current plan: <strong>{store.subscription?.name ?? "Free"}</strong> · {Number(store.subscription?.commissionRate ?? 8)}% commission per sale
      </p>

      {pms === "upgrade" && (
        <div className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_30%,transparent)] bg-[color-mix(in_srgb,var(--bn-admin-surface-2)_5%,transparent)] px-4 py-3 text-sm">
          <strong>BizNest PMS is an Entrepreneurship and Business Mogul app.</strong> Upgrade this hotel to unlock the dedicated property management workspace.
        </div>
      )}

      {apps && apps !== "pms" && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <strong>Upgrade required.</strong> The selected app is not available on your current plan. Choose a supported plan below, then return to Apps to install it.
        </div>
      )}

      {upgraded && (
        <div className="mb-4 rounded-md border border-[color-mix(in_srgb,var(--bn-admin-border)_30%,transparent)] bg-[color-mix(in_srgb,var(--bn-admin-surface-2)_5%,transparent)] px-3 py-2 text-sm text-[var(--bn-admin-orange)]">
          Plan upgraded successfully.
        </div>
      )}
      {payment === "failed" && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Payment didn't complete — you're still on your previous plan. No charge was made.
        </div>
      )}

      <SubscriptionPlans
        slug={slug}
        plans={plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), commissionRate: Number(p.commissionRate), features: p.features }))}
        currentPlanId={store.subscriptionId}
        currentPeriod={store.subscriptionBillingPeriod}
        renewsAtMs={store.subscriptionRenewsAt ? store.subscriptionRenewsAt.getTime() : null}
        renewsLabel={store.subscriptionRenewsAt ? formatDate(store.subscriptionRenewsAt) : null}
      />
    </div>
  );
            }
                
