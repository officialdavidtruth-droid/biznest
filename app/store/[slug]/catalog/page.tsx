import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GrandeurMenu } from "@/components/storefront/grandeur-restaurant";
import { TasteHouseMenu } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";
import { EXAMPLE_TEMPLATE_NAME } from "@/lib/example-content";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { CatalogExperience } from "@/components/storefront/catalog-experience";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { resolveStoreTheme } from "@/lib/template-themes";
import { isRestaurantBusiness, isHotelBusiness } from "@/lib/business-identity";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { buildSystemSlots } from "@/components/storefront/system-slots";
import { fontStack } from "@/lib/builder-safe";
import { TemplateShell } from "@/components/storefront/template-shell";
import { usesTemplateChrome } from "@/lib/storefront/template-chrome";

export default async function CatalogPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ category?: string; q?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true, products: { where: { isPublished: true }, take: 100, include: { category: true } }, services: { where: { isPublished: true }, take: 100, include: { category: true } } } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  const items = [
    ...store.products.map(p => ({ id:p.id, kind:"product" as const, name:p.name, price:Number(p.price), currency:p.currency, image:p.images[0] ?? null, categoryName:p.category?.name ?? undefined, hasVariants:p.hasVariants })),
    ...store.services.map(s => ({ id:s.id, kind:"service" as const, name:s.name, price:Number(s.price), currency:s.currency, image:s.images[0] ?? null, categoryName:s.category?.name ?? undefined })),
  ];
  if (store.template?.name === "Veloura — Superior Luxury Hotel" || isHotelBusiness(store.business?.category)) {
    return <ThelusoHotel store={{...store,address:[store.business?.city,store.business?.state].filter(Boolean).join(", ")||null,phone:store.contactPhone??store.business?.phone??null,email:store.contactEmail??store.business?.email??null}} slug={slug} content={await getHotelContent(slug)} />;
  }
  if (store.template?.name === EXAMPLE_TEMPLATE_NAME) return <ExampleStorefront store={store} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,rentalUnit:null,isBookable:false})) as any} mode="catalog" />;
  if (store.template?.name === TASTEHOUSE_TEMPLATE_NAME) return <TasteHouseMenu store={store} slug={slug} initialCategory={query?.category} items={items.map(i=>({...i,description:null,type:i.kind,isBookable:false})) as any} />;
  if (isRestaurantBusiness(store.business?.category)) return <GrandeurMenu store={store} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,isBookable:false})) as any} />;
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const design = catalogDesign(store, theme);
  const slots = await buildSystemSlots(store, "shop", { text: design.text, accent: design.accent, primary: design.primary, line: `${design.text}1f`, radius: design.radius, headingFont: fontStack(design.headingFont) });
  const chrome = usesTemplateChrome(store.template?.name);
  const page = (
    <CatalogExperience
      externalChrome={chrome}
      topSlot={slots.top}
      bottomSlot={slots.bottom}
      store={catalogStoreInfo(store, slug)}
      design={design}
      items={items.map((i) => ({ id: i.id, kind: i.kind, name: i.name, price: i.price, currency: i.currency, image: i.image, categoryName: i.categoryName ?? null, hasVariants: "hasVariants" in i ? Boolean(i.hasVariants) : false }))}
      initialCategory={query?.category}
      initialQuery={query?.q}
    />
  );
  return chrome ? <TemplateShell store={store} slug={slug} theme={theme}>{page}</TemplateShell> : page;
}
