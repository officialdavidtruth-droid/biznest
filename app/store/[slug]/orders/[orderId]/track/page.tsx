import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrderForBuyer } from "@/lib/actions/order";

export default async function Page({ params }: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await params;
  const s = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!s || s.status !== "ACTIVE") notFound();
  const order = await getOrderForBuyer(orderId, slug);
  if (!order) notFound();

  // Templates without a dedicated tracking view: the order list already shows
  // each order's live status, so send the buyer there rather than a 404.
  redirect(`/store/${slug}/orders`);
}
