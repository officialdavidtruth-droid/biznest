import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Writes one storefront page view. Deliberately NOT a server action (no "use server"):
 * it takes the IP and referrer as arguments, so exposing it as a public endpoint would
 * let a client spoof them and dodge the per-IP rate limit.
 *
 * Callers read the request headers up front and pass the values in, so this can run
 * inside next/server `after()`, where request APIs like headers() are not available.
 */
export async function writeStoreVisit(input: { storeId: string; path: string; ip: string; referrer: string | null }): Promise<void> {
  try {
    const store = await prisma.store.findFirst({ where: { id: input.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return;
    const rate = await checkRateLimit(`store-visit:${input.storeId}:${input.ip}`, 120, 60 * 60 * 1000);
    if (!rate.allowed) return;
    await prisma.storeVisit.create({
      data: { storeId: store.id, path: String(input.path ?? "").slice(0, 500), referrer: input.referrer?.slice(0, 1000) ?? null },
    });
  } catch {
    // Never let analytics logging take down a storefront page.
  }
}
