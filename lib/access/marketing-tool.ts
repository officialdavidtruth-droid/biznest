import { prisma } from "@/lib/prisma";

export type MarketingToolAccess =
  | { status: "signed-out" }
  | { status: "active"; storeSlug: string }
  | { status: "needs-upgrade"; storeSlug: string | null };

/**
 * BizNest Marketing is its own product with its own operational system --
 * separate account, separate subscription, separate everything -- from the
 * main BizNest storefront platform. It is no longer bundled with the
 * Business Mogul plan: running a full store on Business Mogul does not by
 * itself grant Marketing access, and a Marketing subscription does not
 * grant anything on the storefront side.
 *
 * The only way in is a store created through the lightweight
 * /marketing/signup flow (see signUpForMarketing in
 * lib/actions/marketing-signup.ts), which is marked marketingOnly and kept
 * out of the full admin dashboard (see app/store/[slug]/admin/layout.tsx).
 *
 * storeSlug (when present) is the store we'd send the user to in order to
 * resolve their access: their existing marketing-only store's subscription
 * page if they already have one, or null if they have no store at all yet.
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
    select: { slug: true, marketingOnly: true, subscriptionId: true },
    orderBy: { name: "asc" },
  });

  // A marketing-only store is the sole way into BizNest Marketing. A full
  // store's subscription tier (Business Mogul included) is irrelevant here.
  const marketingStore = stores.find((s) => s.marketingOnly);
  if (!marketingStore) {
    // No marketing-only store yet. Never point this at a full (non-marketing)
    // store -- that store's own subscription has nothing to do with Marketing.
    return { status: "needs-upgrade", storeSlug: null };
  }

  // Signup itself no longer implies access -- BizNest Marketing is on its
  // own paid subscription (Starter/Pro, see the isMarketingPlan flag on
  // Subscription), same as the main platform requires an active
  // subscriptionId before the full admin dashboard unlocks. Both the
  // self-serve free-trial path (initiatePlanUpgrade in
  // lib/actions/subscription.ts) and an admin-granted trial (grantUserTrial
  // in lib/actions/admin.ts) set subscriptionId the moment the trial
  // starts, so checking subscriptionId alone already covers "on trial" --
  // no separate trialEndsAt check needed, and nothing here cares whether a
  // trial ever lapses (a lapsed trial with no real payment still leaves
  // subscriptionId set, same as the main platform).
  if (marketingStore.subscriptionId) {
    return { status: "active", storeSlug: marketingStore.slug };
  }

  // Store exists but has never picked a plan (or its trial lapsed) -- send
  // the caller to the Marketing plan picker (/marketing/select-plan), not
  // back through signup again.
  return { status: "needs-upgrade", storeSlug: marketingStore.slug };
}