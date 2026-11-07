import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function PortfolioAlbumPage({ params }: { params: Promise<{ slug: string; albumSlug: string }> }) {
  const { slug, albumSlug } = await params;
  return renderUniversalSectionPage(slug, "portfolio", { albumSlug });
}
