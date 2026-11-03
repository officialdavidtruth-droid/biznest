"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { isSiteMode, type SiteMode } from "@/lib/site-mode";
import type { ActionResult } from "@/types/actions";

/**
 * Switch a store between Simple and Advanced website tooling. Display-only: nothing the owner
 * has saved is changed, the dashboard just shows or hides the technical editors.
 */
export async function setSiteMode(slug: string, mode: string): Promise<ActionResult<{ siteMode: SiteMode }>> {
  if (!isSiteMode(mode)) return { success: false, error: "Choose Simple or Advanced." };

  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  if (access.role === "STAFF") return { success: false, error: "Only the owner or a manager can change this." };

  await prisma.store.update({ where: { id: access.store.id }, data: { siteMode: mode } });

  // The sidebar and mobile menu live in the admin layout, so refresh the whole admin tree.
  revalidatePath(`/${slug}/admin`, "layout");
  return { success: true, data: { siteMode: mode } };
}
