import { GrandeurContact } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getGrandeurRestaurantData(slug);
  if (data) return <GrandeurContact store={data.store} slug={slug} items={data.items} />;
  return renderUniversalSectionPage(slug, "contact");
}
