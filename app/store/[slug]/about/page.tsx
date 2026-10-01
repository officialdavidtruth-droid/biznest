import { isHotelStore } from "@/lib/storefront-routing";
import { prisma } from "@/lib/prisma";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { GrandeurAbout } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await prisma.store.findUnique({ where: { slug }, select: { businessType: true, template: { select: { name: true } } } });
  if (isHotelStore({ storeBusinessType: s?.businessType, templateName: s?.template?.name })) {
    const raw = await prisma.store.findUniqueOrThrow({
      where: { slug },
      select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, storyImage: true, contactPhone: true, contactEmail: true, business: { select: { city: true, state: true, phone: true, email: true } } }
    });
    const store = { ...raw, address: [raw.business?.city, raw.business?.state].filter(Boolean).join(", ") || null, phone: raw.contactPhone ?? raw.business?.phone ?? null, email: raw.contactEmail ?? raw.business?.email ?? null };
    return <ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)} />;
  }
  const data = await getGrandeurRestaurantData(slug);
  if (data) return <GrandeurAbout store={data.store} slug={slug} items={data.items} reviews={data.reviews} />;
  return renderUniversalSectionPage(slug, "about");
}
