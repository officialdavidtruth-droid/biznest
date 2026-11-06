import "server-only";
import { amountCoversExpected } from "@/lib/payments/amount";
import { prisma } from "@/lib/prisma";
import { parseAdReference } from "@/lib/ads";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Ad campaign settlement. Lives outside "use server" files on purpose (it trusts caller-supplied amounts):
 * import it only from the webhook, callback and reconciliation handlers.
 * Activates the campaign exactly once; a replayed callback never extends the run.
 */
export async function settleAdPayment(reference: string, amountNaira: number, rawPayload: object): Promise<ActionResult<{ slug: string }>> {
  const parsed = parseAdReference(reference);
  if (!parsed) return { success: false, error: "Invalid ad payment reference." };
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment?.storeId || payment.purpose !== "AD_CAMPAIGN") return { success: false, error: "Ad payment not found." };
  if (!amountCoversExpected(amountNaira, Number(payment.amount))) return { success: false, error: "Ad payment amount mismatch." };

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.adCampaign.findFirst({ where: { id: parsed.campaignId, storeId: payment.storeId!, paymentReference: reference }, select: { id: true, status: true, durationDays: true, store: { select: { slug: true } } } });
    if (!campaign) return { ok: false as const, error: "Campaign not found for this payment." };

    const claimed = await tx.payment.updateMany({
      where: { reference, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SUCCESSFUL", rawPayload: rawPayload as never, verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({ where: { reference }, select: { status: true } });
      if (current?.status !== "SUCCESSFUL") return { ok: false as const, error: "Ad payment is not pending." };
      return { ok: true as const, slug: campaign.store.slug, applied: false as const };
    }
    const now = new Date();
    const activated = await tx.adCampaign.updateMany({
      where: { id: campaign.id, status: "PENDING_PAYMENT" },
      data: { status: "ACTIVE", startsAt: now, endsAt: new Date(now.getTime() + campaign.durationDays * 86_400_000) },
    });
    return { ok: true as const, slug: campaign.store.slug, applied: activated.count > 0 };
  });

  if (!result.ok) return { success: false, error: result.error };
  if (result.applied) await prisma.auditLog.create({ data: { action: "AD_PAYMENT_COMPLETED", entity: "AdCampaign", entityId: parsed.campaignId, metadata: { storeId: payment.storeId, reference, amountNaira } } });
  revalidatePath(`/store/${result.slug}/admin/ads`);
  revalidatePath("/browse");
  return { success: true, data: { slug: result.slug } };
}
