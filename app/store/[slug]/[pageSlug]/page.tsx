import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveStoreTheme } from "@/lib/template-themes";

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
    include: { template: true },
  });
  if (!store) notFound();

  const page = await prisma.storePage.findUnique({
    where: { storeId_slug: { storeId: store.id, slug: pageSlug } },
  });
  if (!page || !page.isPublished) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const body = (page.content as { body?: string } | null)?.body ?? "";

  return (
    <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font, minHeight: "100vh" }}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/${slug}`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {store.name}
        </Link>

        <h1 className="mb-6 text-3xl font-bold" style={{ color: theme.accent }}>
          {page.title}
        </h1>

        {body ? (
          <div className="space-y-4 whitespace-pre-wrap text-base leading-relaxed opacity-90">{body}</div>
        ) : (
          <p className="text-sm italic opacity-60">This page doesn't have any content yet.</p>
        )}
      </div>
    </div>
  );
}
