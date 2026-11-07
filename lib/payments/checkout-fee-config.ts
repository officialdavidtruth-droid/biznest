import { getActiveGateway } from "@/lib/payments/gateway";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { feeConfigFor, type FeeConfig } from "@/lib/payments/customer-fee";

/**
 * The gateway a store's customers pay through and the fees added to their charge, so a checkout page can show
 * them before paying. A store on its own gateway keys keeps its money there: BizNest sends no payout, so no
 * transfer fee. Returns undefined when the gateway can't be resolved (the page then shows the plain price).
 */
export async function getCheckoutFeeConfig(storeId: string): Promise<FeeConfig | undefined> {
  try {
    const own = await resolveStoreGateway(storeId);
    const gateway = own.status === "ok" ? own.credentials.provider : await getActiveGateway();
    return feeConfigFor(gateway, own.status !== "ok");
  } catch {
    return undefined;
  }
}
