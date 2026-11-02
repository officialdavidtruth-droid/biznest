"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { parsePreorderInput } from "@/lib/preorder";
import type { ActionResult } from "@/types/actions";

/** Turns pre-order mode on/off for a product, with an optional ship date and unit cap. */
export async function setProductPreorder(
  slug: string,
  productId: string,
  input: { enabled: boolean; shipsOn: string; limit: string },
): Promise<ActionResult<void>> {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { success: false, error: a.error };
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: a.store.id },
    select: { id: true, type: true, preorderEnabled: true, isPublished: true, inventory: { select: { id: true, autoUnpublished: true } } },
  });
  if (!product) return { success: false, error: "Product not found." };
  const parsed = parsePreorderInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  if (parsed.data.enabled && product.type !== "PHYSICAL") return { success: false, error: "Pre-orders are only available for physical products." };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { preorderEnabled: parsed.data.enabled, preorderShipsOn: parsed.data.shipsOn, preorderLimit: parsed.data.limit },
    });
    // A product the out-of-stock automation hid can be sold again now that it's a pre-order. A product the
    // merchant unpublished themselves stays as they left it.
    const hiddenByAutomation = !product.isPublished && Boolean(product.inventory?.autoUnpublished);
    if (parsed.data.enabled && hiddenByAutomation) {
      await tx.product.update({ where: { id: product.id }, data: { isPublished: true } });
      await tx.inventoryItem.updateMany({ where: { productId: product.id }, data: { autoUnpublished: false } });
      await tx.productVariant.updateMany({ where: { productId: product.id }, data: { autoUnpublished: false } });
    }
  });
  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/product/${product.id}`);
  return { success: true, data: undefined };
}
