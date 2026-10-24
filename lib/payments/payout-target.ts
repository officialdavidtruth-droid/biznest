/**
 * Whether a store has somewhere for its money to go.
 *
 * Vendors are paid with the gateway Transfer API, which only needs the
 * bank details captured by connectPayoutAccount (lib/actions/store.ts) --
 * independent of which gateway is active. Stores that connected under the
 * old subaccount model have no bank details saved (only a masked number),
 * so until they reconnect we still accept their legacy subaccount as a
 * target. Drop the legacy branch once the subaccount split is removed.
 */
export type StorePayoutFields = {
  payoutBankCode?: string | null;
  payoutAccountNumber?: string | null;
  paystackSubaccountCode?: string | null;
  flutterwaveSubaccountId?: string | null;
};

export function hasBankPayoutDestination(store: StorePayoutFields): boolean {
  return Boolean(store.payoutBankCode && store.payoutAccountNumber);
}

export function storeHasPayoutTarget(store: StorePayoutFields, gateway: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY"): boolean {
  if (hasBankPayoutDestination(store)) return true;
  // Korapay never had a subaccount model: only a saved bank account counts.
  if (gateway === "KORAPAY") return false;
  return gateway === "PAYSTACK" ? Boolean(store.paystackSubaccountCode) : Boolean(store.flutterwaveSubaccountId);
}

/** True when the store only has an old subaccount and must reconnect a bank account. */
export function needsPayoutReconnect(store: StorePayoutFields): boolean {
  return !hasBankPayoutDestination(store) && Boolean(store.paystackSubaccountCode || store.flutterwaveSubaccountId);
}
