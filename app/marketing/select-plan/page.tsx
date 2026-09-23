// Route: /marketing/select-plan
// The mandatory step between "signed up for BizNest Marketing" and
// "workspace unlocked" -- mirrors app/onboarding/select-plan/page.tsx, but
// scoped to the two BizNest Marketing tiers (Starter/Pro, isMarketingPlan:
// true) instead of the main platform's plans, and to marketing-only
// stores. See getMarketingToolAccess in lib/access/marketing-tool.ts for
// the gate this feeds: a marketing-only store with no subscriptionId lands
// here (from signup, or by clicking through MarketingToolLocked) instead
// of the workspace.
//
// Reuses the exact same PlanPicker component and initiatePlanUpgrade
// action as the main platform -- neither cares which product a plan
// belongs to, just its id -- so the free-trial mechanism (the
// billing.free_trial platform setting, edited at /supaadmin/settings)
// behaves identically here: SupaAdmin picks which single plan (if any,
// either product) gets it.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { PlanPicker } from "@/components/forms/plan-picker";
import { getMarketingFreeTrialSetting } from "@/lib/actions/site-settings";

export default async function MarketingSelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/marketing/select-plan${slug ? `?slug=${slug}` : ""}`);
  if (!slug) redirect("/marketing/signup");

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true },
  });
  if (!store || !store.marketingOnly) notFound();
  if (store.business.userId !== session.user.id) redirect("/store/marketing");

  // Already on a plan (paid or trialing) -- nothing to do here.
  if (store.subscriptionId) redirect("/store/marketing");

  const plans = await prisma.subscription.findMany({
    where: { isActive: true, isMarketingPlan: true },
    orderBy: { price: "asc" },
  });
  const trialSetting = await getMarketingFreeTrialSetting();

  return (
    <div className="min-h-screen bg-[#f7fbf8] text-[#102a1c]">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Choose your BizNest Marketing plan</h1>
          <p className="mt-2 text-sm text-slate-600">
            {store.name} is ready — pick a plan to unlock your workspace. Billed monthly, cancel anytime.
          </p>
        </div>
        <PlanPicker
          slug={store.slug}
          plans={plans}
          trialPlanId={trialSetting.enabled ? trialSetting.planId : null}
          trialDays={trialSetting.days}
        />
      </div>
    </div>
  );
}
