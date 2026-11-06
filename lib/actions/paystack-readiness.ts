"use server";

import { isPlatformStaff } from "@/lib/admin-guard";
import { getActiveGateway } from "@/lib/actions/site-settings";
import { PLATFORM_BILLING_GATEWAY } from "@/lib/payments/gateway";
import { getPaystackBalanceKobo } from "@/lib/payments/paystack";
import { evaluatePaystackReadiness, type ReadinessCheck } from "@/lib/payments/paystack-readiness";
import { APP_URL } from "@/lib/constants/app-url";
import type { ActionResult } from "@/types/actions";

/** Runs the Paystack go-live checks for SupaAdmin. Reads configuration and makes one balance call; changes nothing. */
export async function loadPaystackReadiness(): Promise<ActionResult<{ checks: ReadinessCheck[]; live: boolean; blockers: number }>> {
  if (!(await isPlatformStaff())) return { success: false, error: "Admin PIN session expired or invalid. Please sign in again." };
  let balance: { ok: boolean; message: string; kobo?: number } | null = null;
  if (process.env.PAYSTACK_SECRET_KEY) {
    try {
      const r = await getPaystackBalanceKobo();
      balance = { ok: r.status, message: r.message, kobo: r.balanceKobo };
    } catch (err) {
      balance = { ok: false, message: err instanceof Error ? err.message : "Could not reach Paystack." };
    }
  }
  const result = evaluatePaystackReadiness({
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    serverPublicKey: process.env.PAYSTACK_PUBLIC_KEY,
    appUrl: APP_URL,
    activeGateway: await getActiveGateway(),
    billingGateway: PLATFORM_BILLING_GATEWAY,
    balance,
  });
  return { success: true, data: result };
}
