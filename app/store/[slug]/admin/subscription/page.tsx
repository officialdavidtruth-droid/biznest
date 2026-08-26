// Route: /store/[slug]/admin/subscription
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import { UpgradeButton } from "@/components/forms/upgrade-button";

export default async function SubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ upgraded?: string; payment?: string }>;
}) {
  const { slug } = await params;
  const { upgraded, payment } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, business: true } });
  if (!store) return null;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/subscription`);
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) redirect(`/${slug}/admin`);

  const plans = await prisma.subscription.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Subscription</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Current plan: <strong>{store.subscription?.name ?? "Free"}</strong> · {Number(store.subscription?.commissionRate ?? 8)}% commission per sale
      </p>

      {upgraded && (
        <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-700">
          Plan upgraded successfully.
        </div>
      )}
      {payment === "failed" && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Payment didn't complete — you're still on your previous plan. No charge was made.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {plans.map((p) => {
          const isCurrent = p.id === store.subscriptionId || (!store.subscriptionId && p.name === "Free");
          const features = p.features as { products?: number; services?: number; customDomain?: boolean };
          return (
            <div key={p.id} className={`rounded-lg border bg-background p-4 ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}>
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">
                ₦{Number(p.price).toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground">/{p.interval.toLowerCase()}</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li>{Number(p.commissionRate)}% commission</li>
                <li>{features.products === -1 ? "Unlimited products" : `Up to ${features.products ?? 0} products`}</li>
                <li>{features.services === -1 ? "Unlimited services" : `Up to ${features.services ?? 0} services`}</li>
                <li className={features.customDomain ? "text-foreground" : ""}>
                  {features.customDomain ? "✓ Custom domain" : "No custom domain"}
                </li>
              </ul>
              {isCurrent ? (
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current plan</span>
              ) : (
                <UpgradeButton storeSlug={slug} planId={p.id} label={Number(p.price) === 0 ? "Switch to Free" : "Upgrade"} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
            }
                
