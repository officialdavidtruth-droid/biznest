/**
 * Merges duplicate StoreCustomerProfile rows (same store + same email, phone in
 * any format, or login account) into one, re-pointing their orders and CRM leads.
 * Groups that are ambiguous (e.g. different emails sharing a phone) are NOT
 * merged -- they are listed for a person to resolve.
 *
 * Dry run by default; idempotent. Run the phone backfill first.
 *   npx tsx prisma/backfill-customer-phones.ts --apply
 *   npx tsx prisma/merge-duplicate-customer-profiles.ts          # report only
 *   npx tsx prisma/merge-duplicate-customer-profiles.ts --apply  # merge
 */
import { PrismaClient } from "@prisma/client";
import { planProfileMerges } from "../lib/customer-profile-merge";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const profiles = await prisma.storeCustomerProfile.findMany({
    select: { id: true, storeId: true, userId: true, name: true, email: true, phone: true, notes: true, createdAt: true },
  });
  const { plans, review } = planProfileMerges(profiles);
  console.log(`${plans.length} group(s) to merge (${plans.reduce((n, p) => n + p.mergeIds.length, 0)} duplicate rows). ${review.length} need manual review.`);

  for (const r of review) console.log(` REVIEW store ${r.storeId}: ${r.ids.join(", ")} -- ${r.reason}`);
  for (const p of plans) console.log(` ${apply ? "merge" : "would merge"} ${p.mergeIds.join(", ")} -> ${p.keepId} ${JSON.stringify(p.patch)}`);
  if (!apply) return;

  for (const p of plans) {
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { customerProfileId: { in: p.mergeIds } }, data: { customerProfileId: p.keepId } });
      await tx.crmLead.updateMany({ where: { customerId: { in: p.mergeIds } }, data: { customerId: p.keepId } });
      // Delete first: the unique indexes would reject filling an email/phone/
      // account that a duplicate still holds.
      await tx.storeCustomerProfile.deleteMany({ where: { id: { in: p.mergeIds } } });
      if (Object.keys(p.patch).length) await tx.storeCustomerProfile.update({ where: { id: p.keepId }, data: p.patch });
    });
  }
  console.log("Done.");
}

main().finally(() => prisma.$disconnect());
