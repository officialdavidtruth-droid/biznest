import { prisma } from "@/lib/prisma";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { hasBankPayoutDestination } from "@/lib/payments/payout-target";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { storeUrl } from "@/lib/seo";
import {
  buildChecklist,
  countRealListings,
  getStarterIdeas,
  readChecklistMeta,
  type ChecklistState,
  type StarterIdea,
} from "@/lib/onboarding-checklist";

export type FirstSaleChecklistData = {
  state: ChecklistState;
  /** Draft ideas the vendor can add in one click. Empty once the listings step is done. */
  ideas: StarterIdea[];
  /** Public URL customers should be sent to. */
  publicUrl: string;
};

/**
 * Loads everything the "first sale" checklist card needs. Returns null when the
 * owner has dismissed it, so the dashboard page can skip rendering entirely.
 * Server-only (Prisma); the pure logic lives in lib/onboarding-checklist.ts.
 */
export async function loadFirstSaleChecklist(storeId: string): Promise<FirstSaleChecklistData | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      slug: true,
      logoUrl: true,
      businessType: true,
      onboardingProfile: true,
      customDomain: true,
      customDomainStatus: true,
      payoutBankCode: true,
      payoutAccountNumber: true,
      manualPayEnabled: true,
      manualBankName: true,
      manualAccountName: true,
      manualAccountNumber: true,
      manualPayNote: true,
      themeColors: true,
      fontFamily: true,
      sectionOverrides: true,
      whatsappNumber: true,
      contactPhone: true,
      socialLinks: true,
      business: { select: { category: true, sellsProducts: true, offersServices: true } },
    },
  });
  if (!store) return null;

  const meta = readChecklistMeta(store.onboardingProfile);
  if (meta.dismissedAt) return null;

  const category = getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const caps = { sellsProducts: store.business?.sellsProducts ?? true, offersServices: store.business?.offersServices ?? false };

  const [products, services, roomCount, menuCount] = await Promise.all([
    prisma.product.findMany({ where: { storeId }, select: { name: true, isPublished: true }, take: 500 }),
    prisma.service.findMany({ where: { storeId }, select: { name: true, isPublished: true }, take: 500 }),
    // Hotels manage rooms in the PMS, not as products/services.
    category === "Hotel & Lodging" ? prisma.propertyRoom.count({ where: { storeId } }) : Promise.resolve(0),
    prisma.storeMenuItem.count({ where: { storeId } }),
  ]);
  const so = store.sectionOverrides;
  const lookCustomized = store.themeColors != null || !!store.fontFamily || (!!so && typeof so === "object" && !Array.isArray(so) && Object.keys(so as object).length > 0);

  const all = [...products, ...services];
  // Only published listings count: a draft isn't visible to customers yet.
  const publishedNames = all.filter((l) => l.isPublished).map((l) => l.name);

  const state = buildChecklist({
    logoUrl: store.logoUrl,
    realListingCount: countRealListings(publishedNames) + roomCount,
    // Done once the store has connected the bank account it is paid out to (or switched on its own gateway keys).
    hasBankPayout: hasBankPayoutDestination(store) || (await resolveStoreGateway(storeId)).status === "ok",
    needsPayoutReconnect: false,
    linkShared: Boolean(meta.linkSharedAt),
    lookCustomized,
    menuSaved: menuCount > 0,
    category,
    ...caps,
  });

  const listingsDone = state.steps.find((s) => s.id === "listings")?.done ?? false;
  const ideas = listingsDone ? [] : getStarterIdeas(category, caps, all.map((l) => l.name));

  return { state, ideas, publicUrl: storeUrl(store) };
}
