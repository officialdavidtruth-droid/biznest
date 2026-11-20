import "server-only";
import { prisma } from "@/lib/prisma";
import { getActiveGateway } from "@/lib/actions/site-settings";

/** How long an unpaid transfer order keeps its unique amount reserved. */
export const TRANSFER_INTENT_HOURS = 48;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The store's ready dedicated account (preferring the gateway currently switched on), or null. */
export async function getStoreTransferAccount(storeId: string) {
  const accounts = await prisma.storeVirtualAccount.findMany({
    where: { storeId, status: "ACTIVE", NOT: { accountNumber: { startsWith: "PENDING:" } } },
    orderBy: { createdAt: "desc" },
  });
  if (accounts.length === 0) return null;
  const active = await getActiveGateway().catch(() => null);
  return accounts.find((a) => a.provider === active) ?? accounts[0];
}

/**
 * Picks the amount this order should be paid: the payable total plus 1-99 kobo that no other open order of the
 * same store is waiting on. Returns null when every kobo value is taken (very rare).
 */
export function pickUniqueAmount(payable: number, takenAmounts: number[]): number | null {
  const taken = new Set(takenAmounts.map((a) => Math.round(a * 100)));
  const base = Math.round(payable * 100);
  // Start at a spread-out offset so two orders created close together rarely race for the same value.
  const start = 1 + Math.floor(Math.random() * 99);
  for (let i = 0; i < 99; i++) {
    const k = ((start - 1 + i) % 99) + 1;
    if (!taken.has(base + k)) return round2((base + k) / 100);
  }
  return null;
}

/** Reserves a unique expected amount for the order on the store's dedicated account. Idempotent per order. */
export async function createTransferIntent(input: { storeId: string; orderId: string; payable: number }) {
  const account = await getStoreTransferAccount(input.storeId);
  if (!account) return { ok: false as const, error: "This store can't take bank transfers right now." };
  const existing = await prisma.storeTransferIntent.findUnique({ where: { orderId: input.orderId } });
  if (existing) {
    if (existing.status === "OPEN") return { ok: true as const, intent: existing, account };
    await prisma.storeTransferIntent.delete({ where: { id: existing.id } });
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const open = await prisma.storeTransferIntent.findMany({
      where: { storeId: input.storeId, status: "OPEN", expiresAt: { gt: new Date() } },
      select: { amount: true },
    });
    const amount = pickUniqueAmount(input.payable, open.map((o) => Number(o.amount)));
    if (amount == null) return { ok: false as const, error: "Too many transfers are waiting for this store. Please try again shortly." };
    // Re-check just before writing so two checkouts at the same moment don't take the same amount.
    const clash = await prisma.storeTransferIntent.findFirst({ where: { storeId: input.storeId, status: "OPEN", amount, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (clash) continue;
    const intent = await prisma.storeTransferIntent.create({
      data: { storeId: input.storeId, orderId: input.orderId, virtualAccountId: account.id, amount, expiresAt: new Date(Date.now() + TRANSFER_INTENT_HOURS * 3600_000) },
    });
    return { ok: true as const, intent, account };
  }
  return { ok: false as const, error: "Couldn't reserve a transfer amount. Please try again." };
}

/** The open order waiting for exactly this amount on this store, if any. */
export async function findMatchingIntent(storeId: string, amountNaira: number) {
  const amount = round2(amountNaira);
  return prisma.storeTransferIntent.findFirst({
    where: { storeId, status: "OPEN", amount },
    orderBy: { createdAt: "desc" },
  });
}
