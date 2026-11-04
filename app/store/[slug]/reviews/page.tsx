// Route: /store/[slug]/reviews
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page } = await searchParams;
  const head = await prisma.store.findUnique({ where: { slug }, select: { status: true } });
  if (!head || head.status !== "ACTIVE") notFound();
  // Every template shows reviews inside its own header/footer through the shared storefront page.
  return renderUniversalSectionPage(slug, "reviews", { page: Number.parseInt(page ?? "1", 10) });
}
