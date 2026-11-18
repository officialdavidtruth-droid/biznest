// Route: /store/[slug]/orders/track
// Signed-in customers: the orders list (each order opens its own tracking page).
// Everyone else: look an order up by its number + email, no account needed.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { OrderLookupForm } from "./lookup-form";

export default async function OrderTrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true, name: true, themeColors: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  if ((await getStoreCustomerSessionForStore(slug))?.user?.id) redirect(`/store/${slug}/orders`);
  const primary = (store.themeColors as { primary?: string } | null)?.primary;
  return <OrderLookupForm slug={slug} storeName={store.name} accent={primary && /^#[0-9a-f]{3,8}$/i.test(primary) ? primary : "#0f172a"} />;
}
