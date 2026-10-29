import { isStorefrontRenderer } from "@/lib/storefront-routing";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TasteHouseReviews } from "@/components/storefront/tastehouse";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page } = await searchParams;

  const head = await prisma.store.findUnique({ where: { slug }, select: { status: true, template: { select: { name: true } } } });
  if (!head || head.status !== "ACTIVE") notFound();

  // Every template gets a reviews page: TasteHouse keeps its own design, all
  // others use the shared storefront page (header/footer + theme).
  if (!isStorefrontRenderer({ templateName: head.template?.name }, "tastehouse")) {
    return renderUniversalSectionPage(slug, "reviews", { page: Number.parseInt(page ?? "1", 10) });
  }

  const s = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true, reviews: { include: { author: { select: { name: true } }, response: true }, orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!s) notFound();
  return <TasteHouseReviews store={{ ...s, sellsProducts: s.business?.sellsProducts ?? true }} slug={slug} reviews={s.reviews} />;
}
