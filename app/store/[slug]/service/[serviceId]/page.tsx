import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { CatalogItemDetail } from "@/components/storefront/catalog-item-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; serviceId: string }> }): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const service = await prisma.service.findFirst({ where: { id: serviceId, store: { slug } } });
  return service ? { title: `${service.name} — ${slug}`, description: service.description?.slice(0, 150) } : {};
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const service = await prisma.service.findFirst({ where: { id: serviceId, storeId: store.id, isPublished: true }, include: { category: true, reviews: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!service) notFound();
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  return <CatalogItemDetail store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} service={service} theme={theme} businessCategory={store.businessType ?? store.business?.category ?? null} />;
}
