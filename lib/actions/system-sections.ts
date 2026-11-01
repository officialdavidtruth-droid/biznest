"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { updateSectionOverridesJson } from "@/lib/store-overrides";
import { isSystemPageKey, sanitizeSystemSections, withSystemSections, type SystemSections } from "@/lib/storefront/system-sections";

const MAX_PAYLOAD = 200_000;

/**
 * Saves the blocks above and below one platform page (Shop, Product or Cart). Same permission as the rest of the
 * customizer. The write goes through the locked sectionOverrides update so it cannot overwrite a builder or FAQ
 * save made at the same moment.
 */
export async function saveSystemSections(slug: string, page: string, formData: FormData): Promise<ActionResult<SystemSections>> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };
  if (!isSystemPageKey(page)) return { success: false, error: "That page cannot be edited here." };

  const raw = String(formData.get("sections") ?? "");
  if (raw.length > MAX_PAYLOAD) return { success: false, error: "These sections are too large. Remove some blocks and try again." };
  let parsed: unknown = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { return { success: false, error: "The content could not be read. Reload and try again." }; }
  const sections = sanitizeSystemSections(parsed);

  try {
    await updateSectionOverridesJson(access.store.id, (current) => withSystemSections(current, page, sections));
  } catch (error) {
    console.error("saveSystemSections failed", error);
    return { success: false, error: "Could not save right now. Please try again in a moment." };
  }

  // The Customize page is deliberately not revalidated: the editor already holds the saved blocks, and re-rendering that
  // whole page inside this action made the save slow and could leave the button stuck on "Saving".
  try {
    if (page === "product") revalidatePath("/store/[slug]/product/[productId]", "page");
    else revalidatePath(`/store/${slug}/${page === "shop" ? "catalog" : "cart"}`);
  } catch (error) {
    console.error("saveSystemSections revalidate failed", error);
  }
  return { success: true, data: sections };
}
