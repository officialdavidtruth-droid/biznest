import "server-only";
import { amountCoversExpected } from "@/lib/payments/amount";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Plugin purchase settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

export async function settlePluginPurchase(reference: string, amountNaira: number, rawPayload: object): Promise<ActionResult<{ slug: string; pluginKey: string }>> {
  if (!reference.startsWith("PLUG-")) return { success: false, error: "Invalid plugin payment reference." };
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment?.storeId || payment.purpose !== "PLUGIN_PURCHASE") return { success: false, error: "Plugin payment not found." };
  if (!amountCoversExpected(amountNaira, Number(payment.amount))) return { success: false, error: "Plugin payment amount mismatch." };

  // Reference format: PLUG-<storeId>-<pluginId>-<8-char nonce>. Plugin ids and the
  // nonce come from nanoid, whose alphabet contains "-", so the reference must NOT be
  // split on "-". Strip the known prefix and the fixed-length nonce instead.
  const storeId = payment.storeId;
  const prefix = `PLUG-${storeId}-`;
  if (!reference.startsWith(prefix) || reference.length <= prefix.length + 9) return { success: false, error: "Invalid plugin payment." };
  const pluginId = reference.slice(prefix.length, reference.length - 9);
  if (reference[reference.length - 9] !== "-" || !pluginId) return { success: false, error: "Invalid plugin payment." };

  const result = await prisma.$transaction(async (tx) => {
    const plugin = await tx.plugin.findUnique({ where: { id: pluginId }, select: { id: true, key: true, billingInterval: true, isFree: true, price: true } });
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, slug: true } });
    if (!plugin || !store) return { ok: false as const, error: "Plugin or store not found." };

    const claimed = await tx.payment.updateMany({
      where: { reference, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SUCCESSFUL", rawPayload: rawPayload as never, verifiedAt: new Date() },
    });
    // Already settled (webhook or an earlier callback): never re-grant or
    // re-extend, otherwise replaying the callback URL renews the plugin free.
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({ where: { reference }, select: { status: true } });
      if (current?.status !== "SUCCESSFUL") return { ok: false as const, error: "Plugin payment is not pending." };
      return { ok: true as const, slug: store.slug, pluginKey: plugin.key, applied: false as const };
    }
    // Renewing an app that is still running extends from its current end date (no lost days).
    const existing = await tx.storePlugin.findUnique({ where: { storeId_pluginId: { storeId, pluginId } }, select: { status: true, renewsAt: true } });
    const startFrom = existing?.status === "ACTIVE" && existing.renewsAt && existing.renewsAt.getTime() > Date.now() ? existing.renewsAt.getTime() : Date.now();
    const renewsAt = plugin.billingInterval === "MONTHLY" ? new Date(startFrom + 30 * 24 * 60 * 60 * 1000) : plugin.billingInterval === "YEARLY" ? new Date(startFrom + 365 * 24 * 60 * 60 * 1000) : null;
    await tx.storePlugin.upsert({
      where: { storeId_pluginId: { storeId, pluginId } },
      update: { status: "ACTIVE", renewsAt, pastDueSince: null, lastPaymentAt: new Date() },
      create: { storeId, pluginId, status: "ACTIVE", renewsAt, lastPaymentAt: new Date() },
    });
    return { ok: true as const, slug: store.slug, pluginKey: plugin.key, applied: true as const };
  });

  if (!result.ok) return { success: false, error: result.error };
  if (result.applied) await prisma.auditLog.create({ data: { action: "PLUGIN_PAYMENT_COMPLETED", entity: "Plugin", entityId: pluginId, metadata: { storeId, reference, amountNaira } } });
  revalidatePath(`/store/${result.slug}/admin/apps`);
  return { success: true, data: { slug: result.slug, pluginKey: result.pluginKey } };
}
