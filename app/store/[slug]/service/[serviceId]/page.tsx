import { getCanonicalBusinessType } from "@/lib/business-identity";
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
  const service = await prisma.service.findFirst({ where: { id: serviceId, storeId: store.id, isPublished: true }, include: {
      category: true,
      // Display list only: the newest reviews with a first name and any merchant reply.
      reviews: {
        orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { name: true } }, response: { select: { content: true } } },
      },
    },
  });
  if (!service) notFound();
  // Rating and count must cover ALL reviews, not just the 20 fetched for display.
  const reviewAgg = await prisma.review.aggregate({ where: { serviceId: service.id }, _avg: { rating: true }, _count: { _all: true } });
  const reviewStats = { average: reviewAgg._avg.rating ?? null, count: reviewAgg._count._all };
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  return <CatalogItemDetail store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} service={service} reviewStats={reviewStats} theme={theme} businessCategory={getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType })} />;
}