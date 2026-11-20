"use server";

import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { logStoreActivity } from "@/lib/activity-log";
import { getActiveGateway } from "@/lib/actions/site-settings";
import { isVirtualAccountIdentityValid, openVirtualAccount } from "@/lib/payments/virtual-account";

export type StoreVirtualAccountView = { id: string; bankName: string; accountNumber: string; accountName: string; pending: boolean };

async function assertOwner(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store || store.business.userId !== session.user.id) return null;
  return { store, userId: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}

/** The store's dedicated account numbers (owner only). */
export async function getStoreVirtualAccounts(slug: string): Promise<StoreVirtualAccountView[]> {
  const owner = await assertOwner(slug);
  if (!owner) return [];
  const rows = await prisma.storeVirtualAccount.findMany({ where: { storeId: owner.store.id }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, bankName: r.bankName, accountNumber: r.accountNumber.startsWith("PENDING:") ? "" : r.accountNumber, accountName: r.accountName, pending: r.status === "PENDING" }));
}

/**
 * Opens a dedicated account number for the store with whichever gateway SupaAdmin has switched on.
 * The BVN/NIN goes straight to the gateway: it is never saved, logged or returned.
 */
export async function createStoreVirtualAccount(
  slug: string,
  input: { idType: "BVN" | "NIN"; idNumber: string; phone?: string; consent: boolean }
): Promise<ActionResult<StoreVirtualAccountView>> {
  const owner = await assertOwner(slug);
  if (!owner) return { success: false, error: "Only the store owner can open a payment account." };
  if (!input.consent) return { success: false, error: "Please confirm you agree before continuing." };
  const idNumber = String(input.idNumber ?? "").replace(/\s+/g, "");
  if (!isVirtualAccountIdentityValid(idNumber)) return { success: false, error: `Enter your 11-digit ${input.idType}.` };
  if (!owner.email) return { success: false, error: "Your account needs an email address first." };

  const limit = await checkRateLimit(`virtual-account:${owner.store.id}`, 5, 60 * 60_000);
  if (!limit.allowed) return { success: false, error: "Too many tries. Please wait a while and try again." };

  const gateway = await getActiveGateway();
  const existing = await prisma.storeVirtualAccount.findFirst({ where: { storeId: owner.store.id, provider: gateway } });
  if (existing) return { success: false, error: "This store already has an account number." };

  const parts = owner.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || owner.store.name;
  const lastName = parts.slice(1).join(" ") || owner.store.name;
  const reference = `VA-${owner.store.id.slice(-8)}-${randomUUID().replace(/-/g, "").slice(0, 10)}`;

  const result = await openVirtualAccount({
    gateway,
    reference,
    accountName: owner.store.name,
    firstName,
    lastName,
    email: owner.email,
    phone: input.phone?.trim() || null,
    bvn: input.idType === "BVN" ? idNumber : null,
    nin: input.idType === "NIN" ? idNumber : null,
  });
  if (!result.success) return { success: false, error: result.error };

  const row =
    "pending" in result
      ? await prisma.storeVirtualAccount.create({
          data: { storeId: owner.store.id, provider: gateway, accountNumber: `PENDING:${reference}`, bankName: "Wema Bank", accountName: owner.store.name, reference, status: "PENDING" },
        })
      : await prisma.storeVirtualAccount.create({
          data: { storeId: owner.store.id, provider: gateway, accountNumber: result.accountNumber, bankName: result.bankName, accountName: result.accountName, reference },
        });

  await logStoreActivity({ storeId: owner.store.id, actor: { id: owner.userId, name: owner.name, email: owner.email, role: "OWNER" }, action: "VIRTUAL_ACCOUNT_OPENED", target: "Dedicated account number", metadata: { provider: gateway } });
  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: { id: row.id, bankName: row.bankName, accountNumber: row.accountNumber.startsWith("PENDING:") ? "" : row.accountNumber, accountName: row.accountName, pending: row.status === "PENDING" } };
}
