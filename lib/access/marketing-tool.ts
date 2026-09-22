import { prisma } from "@/lib/prisma";

export type MarketingToolAccess =
  | { status: "signed-out" }
  | { status: "mogul"; storeSlug: string }
  | { status: "needs-upgrade"; storeSlug: string | null };

/**
 * The standalone Marketing tool (app/marketing) is bundled free with the
 * Business Mogul plan. Everyone else has to sign in and subscribe before
 * they can use it. "Has Business Mogul" is derived from the user's stores
 * (owner or active staff membership) since subscriptions live on Store,
 * not User -- there's no separate account-level plan.
 *
 * storeSlug (when present) is the store we'd send the user to in order to
 * resolve their access: their existing store's subscription page if they
 * already run one, or null if they have no store at all yet.
 */
export async function getMarketingToolAccess(userId: string | undefined): Promise<MarketingToolAccess> {
  if (!userId) return { status: "signed-out" };

  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { business: { userId } },
        { staffMembers: { some: { userId, status: "ACTIVE" } } },
      ],
    },
    select: { slug: true, marketingOnly: true, subscription: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  // Two independent ways in: a full store on the Business Mogul plan (gets
  // marketing bundled with everything else), or a store created through
  // the lightweight /marketing/signup flow (marketing is *all* it has --
  // see signUpForMarketing in lib/actions/marketing-signup.ts). Either one
  // is enough; a marketing-only store never has a subscription.
  const mogulStore = stores.find((s) => s.subscription?.name === "Business Mogul" || s.marketingOnly);
  if (mogulStore) return { status: "mogul", storeSlug: mogulStore.slug };

  return { status: "needs-upgrade", storeSlug: stores[0]?.slug ?? null };
}