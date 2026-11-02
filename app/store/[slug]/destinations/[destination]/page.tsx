import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDestinationGuide, destinationPhoto } from "@/lib/travel-destinations";
import { getPublicTravelPackages } from "@/lib/travel-public";
import { DestinationDetail } from "@/components/storefront/destination-pages";

type Params = { params: Promise<{ slug: string; destination: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, destination } = await params;
  const guide = getDestinationGuide(destination);
  if (!guide) return {};
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: `${guide.name}, ${guide.region} travel guide | ${store?.name ?? "Travel"}`,
    description: guide.tagline,
    openGraph: { images: [destinationPhoto(guide, 1200)] },
  };
}

export default async function DestinationPage({ params }: Params) {
  const { slug, destination } = await params;
  const guide = getDestinationGuide(destination);
  if (!guide) notFound();
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, logoUrl: true, status: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  // Live tours from this agency's BizNest Travel packages that go to this destination.
  const all = await getPublicTravelPackages(store.id).catch(() => []);
  const packages = all.filter((p) => p.destination.toLowerCase().includes(guide.name.toLowerCase()));
  return <DestinationDetail store={store} slug={slug} guide={guide} packages={packages} />;
}
