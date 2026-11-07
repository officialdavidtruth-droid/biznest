import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { listPortfolioAlbums } from "@/lib/actions/portfolio";
import { PortfolioManager } from "@/components/dashboard/portfolio-manager";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/portfolio`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { slug: true, customDomain: true, customDomainStatus: true } });
  if (!store) notFound();
  const data = await listPortfolioAlbums(slug);
  if ("error" in data) notFound();
  return <PortfolioManager slug={slug} initial={data.albums} portfolioUrl={buildStoreUrl(store, "/portfolio")} />;
}
