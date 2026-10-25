"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/activity-log";
import {
  parseGaId,
  parseMetaPixelId,
  parsePlausibleDomain,
  type TrackingIds,
} from "@/lib/tracking/ids";

export type SaveTrackingResult =
  | { success: true; data: TrackingIds }
  | { success: false; error: string; field?: keyof TrackingIds };

/**
 * Saves a store's analytics / ad-conversion IDs. Any field may be blank to turn
 * that provider off. Same permission as the rest of Settings.
 */
export async function saveTrackingIds(
  slug: string,
  input: { gaId?: string; metaPixelId?: string; plausibleDomain?: string }
): Promise<SaveTrackingResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };

  const ga = parseGaId(input.gaId);
  if (!ga.ok) return { success: false, error: ga.error, field: "gaId" };
  const meta = parseMetaPixelId(input.metaPixelId);
  if (!meta.ok) return { success: false, error: meta.error, field: "metaPixelId" };
  const pl = parsePlausibleDomain(input.plausibleDomain);
  if (!pl.ok) return { success: false, error: pl.error, field: "plausibleDomain" };

  const before = {
    gaId: access.store.trackingGaId,
    metaPixelId: access.store.trackingMetaPixelId,
    plausibleDomain: access.store.trackingPlausibleDomain,
  };

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      trackingGaId: ga.value,
      trackingMetaPixelId: meta.value,
      trackingPlausibleDomain: pl.value,
    },
  });

  const changed = (["gaId", "metaPixelId", "plausibleDomain"] as const).filter(
    (k) => (before[k] ?? null) !== ({ gaId: ga.value, metaPixelId: meta.value, plausibleDomain: pl.value })[k]
  );
  if (changed.length) {
    const session = await auth();
    await logStoreActivity({
      storeId: access.store.id,
      actor: {
        id: session?.user?.id,
        name: session?.user?.name,
        email: session?.user?.email,
        role: access.role ?? "OWNER",
      },
      action: "settings.tracking_updated",
      metadata: { changed },
    });
  }

  // The storefront layout reads these on render; make sure cached output is dropped.
  revalidatePath(`/store/${slug}`, "layout");
  revalidatePath(`/store/${slug}/admin/settings`);

  return { success: true, data: { gaId: ga.value, metaPixelId: meta.value, plausibleDomain: pl.value } };
}
