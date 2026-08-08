import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveStoreTheme } from "@/lib/template-themes";
import { HeroBlockEditor } from "@/components/dashboard/hero-block-editor";
import type { HeroOverrides } from "@/lib/actions/store";

export default async function WebsiteEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true } });
  if (!store) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const heroOverrides = (store.heroOverrides as HeroOverrides | null) ?? {};

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold">Website Editor</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Click directly on the hero below to edit it — proof of concept for a click-to-edit
        storefront builder. Other sections still use the regular Settings and Storefront
        Layout pages for now.
      </p>
      <HeroBlockEditor slug={slug} storeName={store.name} theme={theme} heroImage={heroImage} initial={heroOverrides} />
    </div>
  );
}
