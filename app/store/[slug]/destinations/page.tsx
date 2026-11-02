import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { DestinationIndex } from "@/components/storefront/destination-pages";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  return { title: `Destinations | ${store?.name ?? "Travel"}`, description: "Destination guides: best time to go, highlights and sample itineraries." };
}

export default async function DestinationsPage({ params }: Params) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true, logoUrl: true, status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  return <DestinationIndex store={store} slug={slug} />;
}
