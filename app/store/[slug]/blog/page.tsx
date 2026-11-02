import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isHotelStore } from "@/lib/storefront-routing";
import { prisma } from "@/lib/prisma";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";
import { renderBuilderSubpage } from "@/lib/storefront/builder-subpage";
import { getBlogStoreIfActive, loadBlogIndex, renderBlogIndex, type BlogSearch } from "@/lib/storefront/blog-page";
import { cleanDescription, NO_INDEX, storeUrl } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<BlogSearch> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) return {};
  const sp = await searchParams;
  const canonical = storeUrl(raw, "/blog");
  const title = `Blog | ${raw.name}`;
  const description = cleanDescription(`News, guides and stories from ${raw.name}.`);
  return {
    title, description,
    // Filtered and searched views are thin duplicates of the main feed.
    robots: raw.seoNoIndex ? NO_INDEX : sp.q || sp.tag || sp.category || sp.page ? { index: false, follow: true } : undefined,
    alternates: { canonical, types: { "application/rss+xml": storeUrl(raw, "/blog/rss.xml") } },
    openGraph: { type: "website", url: canonical, title, description, siteName: raw.name, locale: "en_NG" },
  };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  // Stores with the Blog app switched on get the full blog. Until their first post is public, an older
  // page written in Customize > Pages keeps showing, so nobody's existing blog disappears.
  const loaded = await loadBlogIndex(slug, sp);
  if (loaded) {
    const unfiltered = !(sp.category || sp.tag || sp.q);
    if (loaded.data.total === 0 && unfiltered) {
      const legacy = await renderBuilderSubpage(slug, "blog", { onlyIfCustomised: true });
      if (legacy) return legacy;
    }
    return renderBlogIndex(slug, loaded, sp);
  }

  const customised = await renderBuilderSubpage(slug, "blog", { onlyIfCustomised: true });
  if (customised) return customised;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, status: true, name: true, logoUrl: true, bannerUrl: true, businessType: true, template: { select: { name: true } }, business: { select: { category: true } } } });
  if (!store || store.status !== "ACTIVE") notFound();
  if (isHotelStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) { const raw = await prisma.store.findUniqueOrThrow({ where: { slug }, select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true, storyImage: true, contactPhone: true, contactEmail: true, socialLinks: true, business: { select: { description: true, city: true, state: true, phone: true, email: true } } } }); const hotelStore = { ...raw, address: [raw.business?.city, raw.business?.state].filter(Boolean).join(", ") || null, phone: raw.contactPhone ?? raw.business?.phone ?? null, email: raw.contactEmail ?? raw.business?.email ?? null }; return <ThelusoHotel store={hotelStore} slug={slug} content={await getHotelContent(slug)} />; }
  return renderUniversalSectionPage(slug, "blog");
}
