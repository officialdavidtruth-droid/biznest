/**
 * Rewrites StoreCustomerProfile.phone into one canonical form (+234XXXXXXXXXX
 * for Nigerian numbers) so POS lookups and Customer 360 agree. It does NOT
 * merge profiles: it only reports store-level duplicates so a person can
 * decide what to do with them.
 *
 * Dry run by default. Idempotent.
 *   npx tsx prisma/backfill-customer-phones.ts          # report only
 *   npx tsx prisma/backfill-customer-phones.ts --apply  # write changes
 */
import { PrismaClient } from "@prisma/client";
import { canonicalPhone, phoneKey } from "../lib/phone";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const profiles = await prisma.storeCustomerProfile.findMany({
    where: { phone: { not: null } },
    select: { id: true, storeId: true, name: true, phone: true },
  });
  let changed = 0;
  const seen = new Map<string, string[]>();
  for (const p of profiles) {
    const next = canonicalPhone(p.phone);
    if (next && next !== p.phone) {
      changed++;
      if (apply) await prisma.storeCustomerProfile.update({ where: { id: p.id }, data: { phone: next } });
    }
    const key = phoneKey(p.phone);
    if (key) {
      const k = `${p.storeId}:${key}`;
      seen.set(k, [...(seen.get(k) ?? []), `${p.id} (${p.name})`]);
    }
  }
  console.log(`${apply ? "Updated" : "Would update"} ${changed} of ${profiles.length} profiles.`);
  const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
  if (dupes.length) {
    console.log(`\n${dupes.length} phone number(s) shared by more than one profile in the same store (not merged):`);
    for (const [k, ids] of dupes) console.log(` - ${k}: ${ids.join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());
