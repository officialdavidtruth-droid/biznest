import { prisma } from "@/lib/prisma";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
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
      manualPayEnabled: true,
      manualBankName: true,
      manualAccountName: true,
      manualAccountNumber: true,
      manualPayNote: true,
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

  const [products, services, roomCount] = await Promise.all([
    prisma.product.findMany({ where: { storeId }, select: { name: true, isPublished: true }, take: 500 }),
    prisma.service.findMany({ where: { storeId }, select: { name: true, isPublished: true }, take: 500 }),
    // Hotels manage rooms in the PMS, not as products/services.
    category === "Hotel & Lodging" ? prisma.propertyRoom.count({ where: { storeId } }) : Promise.resolve(0),
  ]);

  const all = [...products, ...services];
  // Only published listings count: a draft isn't visible to customers yet.
  const publishedNames = all.filter((l) => l.isPublished).map((l) => l.name);

  const state = buildChecklist({
    logoUrl: store.logoUrl,
    realListingCount: countRealListings(publishedNames) + roomCount,
    // Checkout works once the store has its published bank details OR its own gateway keys switched on.
    hasBankPayout: manualPayReady(manualPayInfoFromStore(store)) || (await resolveStoreGateway(storeId)).status === "ok",
    needsPayoutReconnect: false,
    linkShared: Boolean(meta.linkSharedAt),
    category,
    ...caps,
  });

  const listingsDone = state.steps.find((s) => s.id === "listings")?.done ?? false;
  const ideas = listingsDone ? [] : getStarterIdeas(category, caps, all.map((l) => l.name));

  return { state, ideas, publicUrl: storeUrl(store) };
}
