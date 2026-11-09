"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import type { ActionResult } from "@/types/actions";
import { requestVendorReferralWithdrawal } from "@/lib/referrals/vendor-referral";

export async function withdrawReferralRewards(slug: string): Promise<ActionResult<{ amount: number; status: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };
  const r = await requestVendorReferralWithdrawal(session.user.id);
  if (!r.ok) return { success: false, error: r.error };
  revalidatePath(`/store/${slug}/admin/refer-and-earn`);
  return { success: true, data: { amount: r.amount, status: r.status } };
}
