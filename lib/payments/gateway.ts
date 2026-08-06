import { getActiveGateway } from "@/lib/actions/site-settings";

export { getActiveGateway };
import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { initializeFlutterwaveTransaction } from "@/lib/payments/flutterwave";

type ChargeParams = {
  email: string;
  amountNaira: number; // always pass the real-world Naira amount; each adapter converts as needed
  reference: string;
  callbackUrl: string;
  customerName?: string;
  /** Vendor payout split target — pass the field matching whichever gateway ends up active. */
  paystackSubaccountCode?: string | null;
  flutterwaveSubaccountId?: string | null;
};

type ChargeResult = { success: true; authorizationUrl: string; gateway: "PAYSTACK" | "FLUTTERWAVE" } | { success: false; error: string };

/**
 * Single entry point every checkout/upgrade flow should call instead of
 * importing a specific gateway directly. Whichever provider supaadmin has
 * marked active is the one that actually gets used — flip the switch there
 * and every "Pay now" button on the platform follows without a code change.
 */
export async function chargeCustomer(params: ChargeParams): Promise<ChargeResult> {
  const gateway = await getActiveGateway();

  if (gateway === "FLUTTERWAVE") {
    const init = await initializeFlutterwaveTransaction({
      email: params.email,
      amountNaira: params.amountNaira,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      customerName: params.customerName,
      subaccountId: params.flutterwaveSubaccountId,
    });
    if (init.status !== "success" || !init.data) {
      return { success: false, error: init.message || "Couldn't start the Flutterwave payment." };
    }
    return { success: true, authorizationUrl: init.data.link, gateway: "FLUTTERWAVE" };
  }

  const init = await initializePaystackTransaction({
    email: params.email,
    amountKobo: Math.round(params.amountNaira * 100),
    reference: params.reference,
    callbackUrl: params.callbackUrl,
    subaccountCode: params.paystackSubaccountCode,
  });
  if (!init.status || !init.data) {
    return { success: false, error: init.message || "Couldn't start the Paystack payment." };
  }
  return { success: true, authorizationUrl: init.data.authorization_url, gateway: "PAYSTACK" };
}
