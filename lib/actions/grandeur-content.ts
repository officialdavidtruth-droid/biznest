"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { GrandeurEvent, GrandeurGalleryItem, GrandeurVideo } from "@/lib/grandeur-content";

type GrandeurStorefrontConfig = {
  grandeurEvents?: { events: GrandeurEvent[] };
  grandeurGallery?: { items: GrandeurGalleryItem[]; videos: GrandeurVideo[] };
};

// Same gate as the storefront settings/hero/story overrides (see
// assertStoreAccess in lib/actions/store.ts) -- content management lives
// under "settings" in the staff permission set, not owner-only.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/** Combined initial state for the admin Events/Gallery editor. */
export async function getGrandeurAdminContent(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { storefrontConfig: true } });
  const config = (store?.storefrontConfig as GrandeurStorefrontConfig | null) ?? {};
  return {
    events: config.grandeurEvents ?? { events: [] },
    gallery: config.grandeurGallery ?? { items: [], videos: [] },
  };
}

export async function saveGrandeurEvents(
  slug: string,
  payload: { type: "grandeur-events"; events: GrandeurEvent[] }
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = (access.store.storefrontConfig as GrandeurStorefrontConfig | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: { storefrontConfig: { ...existing, grandeurEvents: { events: payload.events } } },
  });

  revalidatePath(`/store/${slug}/admin/events`);
  revalidatePath(`/store/${slug}/events`);
  return { success: true, data: undefined };
}

export async function saveGrandeurGallery(
  slug: string,
  payload: { type: "grandeur-gallery"; items: GrandeurGalleryItem[]; videos: GrandeurVideo[] }
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = (access.store.storefrontConfig as GrandeurStorefrontConfig | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: { storefrontConfig: { ...existing, grandeurGallery: { items: payload.items, videos: payload.videos } } },
  });

  revalidatePath(`/store/${slug}/admin/gallery`);
  revalidatePath(`/store/${slug}/gallery`);
  return { success: true, data: undefined };
  }
  
