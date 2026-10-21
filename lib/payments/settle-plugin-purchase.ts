import "server-only";

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
  if (Math.abs(Number(payment.amount) - amountNaira) > 0.01) return { success: false, error: "Plugin payment amount mismatch." };

  const parts = reference.split("-");
  const storeId = parts[1];
  const pluginId = parts[2];
  if (storeId !== payment.storeId) return { success: false, error: "Invalid plugin payment." };

  const result = await prisma.$transaction(async (tx) => {
    const plugin = await tx.plugin.findUnique({ where: { id: pluginId }, select: { id: true, key: true, billingInterval: true, isFree: true, price: true } });
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { id: true, slug: true } });
    if (!plugin || !store) return { ok: false as const, error: "Plugin or store not found." };

    const claimed = await tx.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: rawPayload as never, verifiedAt: new Date() },
    });
    // Already settled (webhook or an earlier callback): never re-grant or
    // re-extend, otherwise replaying the callback URL renews the plugin free.
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({ where: { reference }, select: { status: true } });
      if (current?.status !== "SUCCESSFUL") return { ok: false as const, error: "Plugin payment is not pending." };
      return { ok: true as const, slug: store.slug, pluginKey: plugin.key, applied: false as const };
    }
    const renewsAt = plugin.billingInterval === "MONTHLY" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : plugin.billingInterval === "YEARLY" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
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
