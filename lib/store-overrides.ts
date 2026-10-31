import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Overrides = Record<string, unknown>;

/**
 * Changes Store.sectionOverrides without losing concurrent edits.
 *
 * The column is one JSON document shared by several editors (visual builder, AI store builder, FAQ, example
 * content). Reading it, changing it in memory and writing it back lets two near-simultaneous saves overwrite
 * each other. This locks the store row, re-reads the current document inside the transaction, applies `change`
 * to it and writes the result, so each save is applied on top of the latest one.
 */
export async function updateSectionOverridesJson(storeId: string, change: (current: Overrides) => Overrides): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ sectionOverrides: unknown }[]>`SELECT "sectionOverrides" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
    const raw = rows[0]?.sectionOverrides;
    const current: Overrides = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Overrides) } : {};
    await tx.store.update({ where: { id: storeId }, data: { sectionOverrides: change(current) as Prisma.InputJsonValue } });
  });
}
