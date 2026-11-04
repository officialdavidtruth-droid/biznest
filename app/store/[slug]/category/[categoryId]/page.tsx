import { prisma } from "@/lib/prisma";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { isHotelStore } from "@/lib/storefront-routing";
import type { Metadata } from "next";
import { CatalogExperience } from "@/components/storefront/catalog-experience";
import { TemplateShell } from "@/components/storefront/template-shell";
import { usesTemplateChromeFor } from "@/lib/storefront/template-chrome";
import { usesGrandeurSkin } from "@/lib/store-pages";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { NO_INDEX, absoluteUrl, cleanDescription, storeUrl } from "@/lib/seo";
import { resolveStoreTheme } from "@/lib/template-themes";
import { findStoreCategory } from "@/lib/category-lookup";
import { categorySegment } from "@/lib/category-slug";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; categoryId: string }> }): Promise<Metadata> {
  const { slug, categoryId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, logoUrl: true, bannerUrl: true, customDomain: true, customDomainStatus: true, seoNoIndex: true } });
  const found = store && store.status === "ACTIVE" ? await findStoreCategory(store.id, categoryId) : null;
  const category = found?.isActive ? found : null;
  if (!store || !category) return { title: "Category", robots: NO_INDEX };

  const title = `${category.name} — ${store.name}`;
  const description = cleanDescription(category.description) ?? `Browse ${category.name} from ${store.name} on BizNest.`;
  const canonical = storeUrl(store, `/category/${categorySegment(category)}`); // always the slug URL, even when reached by an old id link
  const image = absoluteUrl(category.imageUrl) ?? absoluteUrl(store.bannerUrl) ?? absoluteUrl(store.logoUrl);
  return {
    title,
    description,
    robots: store.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description, siteName: store.name, locale: "en_NG", ...(image ? { images: [{ url: image, alt: category.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string; categoryId: string }> }) {
  const { slug, categoryId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const category = await findStoreCategory(store.id, categoryId);
  if (!category) notFound();
  // Reached by id (an old link) or by a differently-cased address: send everyone, and search engines, to the one slug URL.
  if (category.slug && categoryId !== category.slug) permanentRedirect(`/store/${slug}/category/${category.slug}`);

  // Hotel stores have dedicated pages (Amenities, Dining, Gallery...). Their
  // header categories are just nav labels with no products, so the generic
  // product grid would render an empty "0 shown" page. Send each one to the
  // matching hotel page instead.
  if (isHotelStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const name = category.name.toLowerCase();
    const target =
      /amenit|facilit/.test(name) ? "/amenities" :
      /dining|restaurant|bar|food/.test(name) ? "/dining" :
      /gallery|photo/.test(name) ? "/gallery" :
      /experience|activit/.test(name) ? "/experiences" :
      /event/.test(name) ? "/events" :
      /about/.test(name) ? "/about" :
      /contact/.test(name) ? "/contact" :
      "/catalog";
    redirect(`/store/${slug}${target}`);
  }
  const ids = category.children.length ? [category.id, ...category.children.map(c=>c.id)] : [category.id];
  const [products, services] = await Promise.all([
    prisma.product.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
    prisma.service.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
  ]);
  const items = [...products.map(p=>({id:p.id,kind:"product" as const,name:p.name,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name??null,hasVariants:p.hasVariants})), ...services.map(s=>({id:s.id,kind:"service" as const,name:s.name,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name??null}))];
  if (usesGrandeurSkin({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const { GrandeurMenu } = await import("@/components/storefront/grandeur-restaurant");
    return <GrandeurMenu store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,rentalUnit:null,isBookable:false})) as any}/>;
  }
  const theme=resolveStoreTheme(store.template?.category,store.name,store.themeColors as any,store.fontFamily,store.template?.name);
  const chrome = usesTemplateChromeFor(store.template?.name, store.sectionOverrides, { businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const page = (
    <CatalogExperience
      externalChrome={chrome}
      mode="category"
      heading={category.name}
      store={catalogStoreInfo(store, slug)}
      design={catalogDesign(store, theme)}
      items={items}
    />
  );
  return chrome ? <TemplateShell store={store} slug={slug} theme={theme}>{page}</TemplateShell> : page;
}
