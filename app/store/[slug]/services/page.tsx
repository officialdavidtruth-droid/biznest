import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return renderUniversalSectionPage(slug, "services", { page: Number(query?.page) || 1 });
}
