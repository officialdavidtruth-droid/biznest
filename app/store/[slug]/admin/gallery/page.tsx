import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getHospitalityGallery } from "@/lib/actions/hospitality-content";
import { HospitalityGalleryManager } from "@/components/dashboard/hospitality-gallery-manager";

export default async function HospitalityGalleryAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();
  if (store.business.category !== "Hotel & Lodging") notFound();
  const gallery = await getHospitalityGallery(slug);
  return <HospitalityGalleryManager slug={slug} initial={gallery} />;
}
