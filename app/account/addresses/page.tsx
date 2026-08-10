import { listAddresses } from "@/lib/actions/account";
import { AddressManager } from "@/components/account/address-manager";

export default async function AddressesPage() {
  const addresses = await listAddresses();
  return <AddressManager initialAddresses={addresses} />;
}
