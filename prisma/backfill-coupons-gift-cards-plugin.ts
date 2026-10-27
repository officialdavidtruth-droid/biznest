/**
 * One-off migration for the "Coupons & Gift Cards" app (key: coupons-gift-cards).
 *
 * Coupons and Gift cards used to be built into every dashboard. They are now a
 * free installable app, so stores that already use them are installed
 * automatically (nothing disappears for them), and invited staff who had the
 * "marketing" permission are granted the new app permission so they keep access.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx prisma/backfill-coupons-gift-cards-plugin.ts
 */

import { PrismaClient } from "@prisma/client";
import { ensureSystemPlugins } from "@/lib/plugins";

const prisma = new PrismaClient();
const KEY = "coupons-gift-cards";
const PERMISSION = `plugin:${KEY}`;

async function main() {
  await ensureSystemPlugins();
  const plugin = await prisma.plugin.findUnique({ where: { key: KEY }, select: { id: true } });
  if (!plugin) throw new Error(`Plugin ${KEY} was not created.`);

  const [couponStores, giftCardStores] = await Promise.all([
    prisma.coupon.findMany({ distinct: ["storeId"], select: { storeId: true } }),
    prisma.giftCard.findMany({ distinct: ["storeId"], select: { storeId: true } }),
  ]);
  const storeIds = [...new Set([...couponStores, ...giftCardStores].map((r) => r.storeId))];

  let installed = 0;
  for (const storeId of storeIds) {
    await prisma.storePlugin.upsert({
      where: { storeId_pluginId: { storeId, pluginId: plugin.id } },
      update: { status: "ACTIVE" },
      create: { storeId, pluginId: plugin.id, status: "ACTIVE" },
    });
    installed++;
  }

  const staff = await prisma.storeStaff.findMany({
    where: { storeId: { in: storeIds }, permissions: { has: "marketing" }, NOT: { permissions: { has: PERMISSION } } },
    select: { id: true, permissions: true },
  });
  for (const member of staff) {
    await prisma.storeStaff.update({ where: { id: member.id }, data: { permissions: [...member.permissions, PERMISSION] } });
  }

  console.log(`Installed ${KEY} for ${installed} store(s); granted app permission to ${staff.length} staff member(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
