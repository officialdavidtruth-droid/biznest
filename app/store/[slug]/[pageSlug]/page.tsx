import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveStoreTheme } from "@/lib/template-themes";
import { UniversalSectionPage, isUniversalSectionPage } from "@/components/storefront/universal-section-pages";

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
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;

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
    // The owner writes their own terms/privacy/refund text in Admin -> Pages ("policies").
    // Only a published page with content is shown; otherwise a neutral notice, never invented legal text.
    const policyBody = String((page?.content as { body?: string } | null)?.body ?? "").trim();
    const policy = pageSlug.toLowerCase() === "policies" && page?.isPublished && policyBody ? { title: page.title, body: policyBody } : null;
    // Merchant-written FAQ (Admin -> Pages -> "faq"): blank-line separated blocks, first line = question, rest = answer.
    const faq = pageSlug.toLowerCase() === "faq" && page?.isPublished && policyBody
      ? policyBody.split(/\n{2,}/).map((b) => b.trim().split("\n")).map(([q, ...a]) => ({ q: q.trim(), a: a.join("\n").trim() })).filter((x) => x.q && x.a).slice(0, 20)
      : [];
    return <UniversalSectionPage store={store} slug={slug} pageSlug={pageSlug} items={items} reviews={store.reviews} theme={theme} social={social} policy={policy} faq={faq} />;
  }

  if (!page) notFound();

  const body = String((page.content as { body?: string } | null)?.body ?? "").trim();

  if (!page.isPublished) notFound();

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

        {body ? (
          <div className="space-y-4 text-base leading-relaxed whitespace-pre-line">{body}</div>
        ) : (
          <p className="text-sm italic opacity-60">This page is coming soon.</p>
        )}
      </div>
    </div>
  );
}
