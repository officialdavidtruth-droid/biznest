import { notFound } from "next/navigation";
import { getPmsData, getPmsAccessStatus } from "@/lib/actions/pms";
import { prisma } from "@/lib/prisma";
import { PmsWorkspace } from "@/components/dashboard/pms-workspace";

export default async function PmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getPmsAccessStatus(slug);
  if (!access.allowed) notFound();
  const [data, store] = await Promise.all([
    getPmsData(slug),
    prisma.store.findUnique({ where: { slug }, select: { name: true } }),
  ]);
  if (!data || !store) notFound();
  return <PmsWorkspace slug={slug} storeName={store.name} rooms={data.rooms} guests={data.guests} reservations={data.reservations} />;
}
