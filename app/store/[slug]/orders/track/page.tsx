// Route: /store/[slug]/orders/track
// Order tracking is the orders list (each order opens its own tracking page), drawn by the shared pages.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function OrderTrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  redirect(`/store/${slug}/orders`);
}
