import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrderForBuyer } from "@/lib/actions/order";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { TasteHouseTrack } from "@/components/storefront/tastehouse";
import { EXAMPLE_TEMPLATE_NAME } from "@/lib/example-content";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";

export default async function Page({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const s = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!s || s.status !== "ACTIVE") notFound();
  const order = await getOrderForBuyer(orderId, slug);
  if (!order) notFound();

  const store = { ...s, sellsProducts: s.business?.sellsProducts ?? true };
  if (s.template?.name === EXAMPLE_TEMPLATE_NAME) {
    return <ExampleStorefront store={store} slug={slug} items={[]} mode="track" order={order} />;
  }
  if (s.template?.name === TASTEHOUSE_TEMPLATE_NAME) {
    return <TasteHouseTrack store={store} slug={slug} order={order} />;
  }
  // Templates without a dedicated tracking view: the order list already shows
  // each order's live status, so send the buyer there rather than a 404.
  redirect(`/store/${slug}/orders`);
}
