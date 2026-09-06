import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function PortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderUniversalSectionPage(slug, "portfolio");
}
