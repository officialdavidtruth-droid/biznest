"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
import { MAX_ORIGINAL_LENGTH, MAX_REPLACEMENT_LENGTH, MAX_TEXT_OVERRIDES, normalizeText, readTextOverrides, sanitizeTextOverrides, type TextOverrides } from "@/lib/storefront/text-overrides";

/**
 * Sets (or, with an empty `value`, removes) the replacement for one piece of storefront wording.
 * Reads the current config inside the write so it never clobbers the other keys in storefrontConfig.
 */
export async function saveTextOverride(slug: string, original: string, value: string): Promise<ActionResult<TextOverrides>> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };

  const key = normalizeText(original);
  const next = value.replace(/\r/g, "").trim();
  if (!key) return { success: false, error: "Nothing to change." };
  if (key.length > MAX_ORIGINAL_LENGTH) return { success: false, error: "That text is too long to change here. Edit it where it was written (a page or section)." };
  if (next.length > MAX_REPLACEMENT_LENGTH) return { success: false, error: `Keep it under ${MAX_REPLACEMENT_LENGTH} characters.` };

  const current = await prisma.store.findUnique({ where: { id: access.store.id }, select: { storefrontConfig: true } });
  const base = current?.storefrontConfig && typeof current.storefrontConfig === "object" && !Array.isArray(current.storefrontConfig) ? (current.storefrontConfig as Record<string, unknown>) : {};
  const overrides = readTextOverrides(base);
  if (!next || next === key) delete overrides[key];
  else {
    if (!(key in overrides) && Object.keys(overrides).length >= MAX_TEXT_OVERRIDES) return { success: false, error: "You've reached the limit of changed texts. Reset some first." };
    overrides[key] = next;
  }
  const clean = sanitizeTextOverrides(overrides);
  await prisma.store.update({ where: { id: access.store.id }, data: { storefrontConfig: { ...base, textOverrides: clean } as object } });
  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: clean };
}
