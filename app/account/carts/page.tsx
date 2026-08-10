import { listSavedCarts } from "@/lib/actions/account";
import { SavedCartsList } from "@/components/account/saved-carts-list";

export default async function SavedCartsPage() {
  const carts = await listSavedCarts();
  return <SavedCartsList initialCarts={carts} />;
}
