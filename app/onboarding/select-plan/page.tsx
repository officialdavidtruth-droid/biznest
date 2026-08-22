import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { PlanPicker } from "@/components/forms/plan-picker";
import { getFreeTrialSetting } from "@/lib/actions/site-settings";

/**
 * The mandatory checkout step between "store created" and "dashboard
 * unlocked." There is no free plan — every store must have an active,
 * paid Subscription before app/store/[slug]/admin/layout.tsx will render
 * anything past this page (see the redirect there). Landing here again
 * after already being on a plan (e.g. back button) just bounces forward.
 */
export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/onboarding/select-plan${slug ? `?slug=${slug}` : ""}`);
  if (!slug) redirect("/onboarding/create-store");

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true, subscription: true },
  });
  if (!store) notFound();
  if (store.business.userId !== session.user.id) redirect("/");

  // Already paid — nothing to do here.
  if (store.subscriptionId) redirect(`/${store.slug}/admin`);

  const plans = await prisma.subscription.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
  const trialSetting = await getFreeTrialSetting();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {store.name} is ready — pick a plan to unlock your dashboard. Billed monthly, cancel anytime.
        </p>
      </div>
      <PlanPicker
        slug={store.slug}
        plans={plans}
        trialPlanId={trialSetting.enabled ? trialSetting.planId : null}
        trialDays={trialSetting.days}
      />
    </div>
  );
}
