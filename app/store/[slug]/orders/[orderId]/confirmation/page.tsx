import { getOrderForBuyer } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { GrandeurConfirmation } from "@/components/storefront/grandeur-restaurant";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const order = await getOrderForBuyer(orderId, slug);
  if (!order) notFound();
  const data = await getGrandeurRestaurantData(slug);
  if (data) return <GrandeurConfirmation store={data.store} slug={slug} order={order} />;
  notFound();
}
