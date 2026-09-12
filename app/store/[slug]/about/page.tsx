import { GrandeurAbout } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getGrandeurRestaurantData(slug);
  if (data) return <GrandeurAbout store={data.store} slug={slug} items={data.items} />;
  return renderUniversalSectionPage(slug, "about");
}
