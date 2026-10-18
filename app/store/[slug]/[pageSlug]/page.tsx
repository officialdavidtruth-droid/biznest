import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveStoreTheme } from "@/lib/template-themes";
import { UniversalSectionPage, isUniversalSectionPage } from "@/components/storefront/universal-section-pages";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPageBlocks, hasVisibleContent } from "@/lib/page-blocks";
import { PageBlocksRenderer } from "@/components/storefront/page-blocks-renderer";
import { PageBlockEditor } from "@/components/dashboard/page-block-editor";

/**
 * Renders one of a store's extra pages (About, Gallery, FAQ, Blog, Contact,
 * Policies, or any custom slug), created in the admin "Pages" panel
 * (components/dashboard/customizer-client.tsx). Unlike the homepage, these
 * don't yet have per-template chrome — one clean layout, tinted with the
 * store's resolved theme colors, works across every template and keeps this
 * route simple. Only published pages resolve; everything else 404s so a
 * draft never leaks a real URL.
 */
export default async function StorePagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
  searchParams?: Promise<{ edit?: string }>;
}) {
  const { slug, pageSlug } = await params;
  const wantsEdit = (await searchParams)?.edit === "1";

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 30, include: { category: true } },
      services: { where: { isPublished: true }, take: 30, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!store) notFound();

  const page = await prisma.storePage.findUnique({
    where: { storeId_slug: { storeId: store.id, slug: pageSlug } },
  });

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);

  // Services/About/Portfolio/Pricing/Contact are platform-level storefront
  // sections, so they must work even when a merchant has not manually created
  // StorePage records for them. Custom pages below still require publication.
  if (isUniversalSectionPage(pageSlug)) {
    const items = [
      ...store.products.map((x: any) => ({ id:x.id, kind:"product" as const, name:x.name, description:null, price:Number(x.price), currency:x.currency, image:x.images?.[0] ?? null, categoryName:x.category?.name ?? null, type:x.type, rentalUnit:x.rentalPeriodUnit ?? null, isBookable:false })),
      ...store.services.map((x: any) => ({ id:x.id, kind:"service" as const, name:x.name, description:x.description, price:Number(x.price), currency:x.currency, image:x.images?.[0] ?? null, categoryName:x.category?.name ?? null, type:"SERVICE", rentalUnit:null, isBookable:x.isBookable })),
    ];
    const social = (store.socialLinks as Record<string,string> | null) ?? {};
    return <UniversalSectionPage store={store} slug={slug} pageSlug={pageSlug} items={items} reviews={store.reviews} theme={theme} social={social} />;
  }

  if (!page) notFound();

  const blocks = getPageBlocks(page.content);
  const isEmpty = !hasVisibleContent(blocks);

  // Only look up the viewer's access when it can change what they see:
  // drafts, empty pages (builder) and explicit ?edit=1. Normal published
  // pages stay a plain public render.
  let canEdit = false;
  if (!page.isPublished || isEmpty || wantsEdit) {
    const access = await assertStorePermission(slug, "settings");
    canEdit = access.success;
  }

  if (!page.isPublished && !canEdit) notFound();

  // WordPress-style: an empty page (or ?edit=1) gives the owner a block builder.
  if (canEdit && (isEmpty || wantsEdit)) {
    return (
      <div style={{ minHeight: "100vh" }} className="bg-background">
        <PageBlockEditor
          slug={slug}
          pageSlug={pageSlug}
          title={page.title}
          initialBlocks={blocks}
          isPublished={page.isPublished}
        />
      </div>
    );
  }

  const catalogItems = [
    ...store.products.map((x: any) => ({ id: x.id, kind: "product" as const, name: x.name, price: Number(x.price), currency: x.currency, image: x.images?.[0] ?? null })),
    ...store.services.map((x: any) => ({ id: x.id, kind: "service" as const, name: x.name, price: Number(x.price), currency: x.currency, image: x.images?.[0] ?? null })),
  ];

  return (
    <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font, minHeight: "100vh" }}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/store/${slug}`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {store.name}
        </Link>

        <h1 className="mb-6 text-3xl font-bold" style={{ color: theme.accent }}>
          {page.title}
        </h1>

        {isEmpty ? (
          <p className="text-sm italic opacity-60">This page is coming soon.</p>
        ) : (
          <PageBlocksRenderer
            blocks={blocks}
            theme={theme}
            slug={slug}
            items={catalogItems}
            contact={{
              phone: store.contactPhone ?? store.business?.phone ?? null,
              email: store.contactEmail ?? store.business?.email ?? null,
              address: [store.business?.city, store.business?.state].filter(Boolean).join(", ") || null,
            }}
          />
        )}
      </div>
    </div>
  );
}
