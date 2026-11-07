/**
 * Stops one customer starting the same payment twice within a few seconds (double-click, two tabs, a retry
 * on a slow connection). Flows that create a fresh reference for each attempt would otherwise open two
 * payment pages, and a customer who completes both is debited twice.
 *
 * Fails open: if the limiter itself is unavailable the payment proceeds, because blocking a real payment is worse.
 */
export const PAYMENT_ALREADY_STARTING = "A payment for this is already being started. Give it a few seconds, or finish the payment page that opened.";

export async function acquirePaymentInitLock(key: string, windowSeconds = 15): Promise<boolean> {
  try {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const r = await checkRateLimit(`pay-init:${key}`, 1, windowSeconds * 1000);
    return r.allowed;
  } catch {
    return true;
  }
}
