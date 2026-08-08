import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveStoreTheme } from "@/lib/template-themes";
import { HeroBlockEditor } from "@/components/dashboard/hero-block-editor";
import { StoryBlockEditor } from "@/components/dashboard/story-block-editor";
import type { HeroOverrides, StoryOverrides } from "@/lib/actions/store";

export default async function WebsiteEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heroImage = store.bannerUrl || store.template?.previewUrl || null;
  const heroOverrides = (store.heroOverrides as HeroOverrides | null) ?? {};
  const storyOverrides = (store.storyOverrides as StoryOverrides | null) ?? {};

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold">Website Editor</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Click directly on a section below to edit its text and images — proof of concept for a
        click-to-edit storefront builder. To change your template or section order/visibility,
        use <a href={`/store/${slug}/admin/customize`} className="font-medium text-foreground underline">Customize Website</a> instead.
      </p>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Hero</h2>
      <HeroBlockEditor slug={slug} storeName={store.name} theme={theme} heroImage={heroImage} initial={heroOverrides} />

      {store.business.description && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold text-muted-foreground">Story / About</h2>
          <StoryBlockEditor
            slug={slug}
            storeName={store.name}
            description={store.business.description}
            heroImage={heroImage}
            initial={storyOverrides}
          />
        </>
      )}
    </div>
  );
}
