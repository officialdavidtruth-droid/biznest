import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme } from "@/lib/template-themes";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { jsonLdString, storeUrl } from "@/lib/seo";
import { plainText, formatPostDate } from "@/lib/blog";
import { getBlogIndex, getBlogPost, isBlogActive, toCardView } from "@/lib/blog-public";
import { outline, parseMarkdown } from "@/lib/blog-markdown";
import { MarkdownView } from "@/components/blog/markdown-view";
import { BlogIndexView, BlogPostView } from "@/components/storefront/blog-views";

/** Cached per request so generateMetadata and the page share one store query. */
export const getBlogStore = cache(async (slug: string) => {
  const raw = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!raw || raw.status !== "ACTIVE") return null;
  return raw;
});

/** The store, only when its Blog app is switched on. Everything else about /blog stays as it was. */
export const getBlogStoreIfActive = cache(async (slug: string) => {
  const raw = await getBlogStore(slug);
  if (!raw || !(await isBlogActive(raw.id))) return null;
  return raw;
});

function look(raw: NonNullable<Awaited<ReturnType<typeof getBlogStore>>>, slug: string) {
  const theme = resolveStoreTheme(raw.template?.category, raw.name, raw.themeColors as any, raw.fontFamily, raw.template?.name);
  return { store: catalogStoreInfo(raw, slug), design: catalogDesign(raw, theme) };
}

export type BlogSearch = { page?: string; category?: string; tag?: string; q?: string };

export async function loadBlogIndex(slug: string, sp: BlogSearch) {
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) return null;
  const data = await getBlogIndex(raw.id, { page: Number(sp.page) || 1, category: sp.category?.slice(0, 80), tag: sp.tag?.slice(0, 40), q: sp.q });
  return { raw, data };
}

export function renderBlogIndex(slug: string, loaded: NonNullable<Awaited<ReturnType<typeof loadBlogIndex>>>, sp: BlogSearch) {
  const { raw, data } = loaded;
  const { store, design } = look(raw, slug);
  return (
    <BlogIndexView
      store={store} design={design} featured={data.featured ? toCardView(data.featured) : null} posts={data.posts.map(toCardView)}
      page={data.page} totalPages={data.totalPages} total={data.total} categories={data.categories} tags={data.tags}
      activeCategory={data.category ? { name: data.category.name, slug: data.category.slug } : null} activeTag={sp.tag?.slice(0, 40) || null} query={sp.q?.trim().slice(0, 80) ?? ""}
    />
  );
}

export async function renderBlogPostPage(slug: string, postSlug: string) {
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) notFound();
  const found = await getBlogPost(raw.id, postSlug);
  if (!found) notFound();
  const { post, related, newer, older } = found;
  const { store, design } = look(raw, slug);
  const blocks = parseMarkdown(post.body);
  const url = storeUrl(raw, `/blog/${post.slug}`);
  const card = toCardView(post);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", headline: post.title, description: post.seoDescription || card.excerpt, mainEntityOfPage: url, url,
        datePublished: post.publishedAt?.toISOString(), dateModified: post.updatedAt.toISOString(),
        ...(post.featuredImage ? { image: post.featuredImage.startsWith("/") ? storeUrl(raw, post.featuredImage) : post.featuredImage } : {}),
        author: { "@type": "Person", name: post.authorName }, publisher: { "@type": "Organization", name: raw.name, ...(raw.logoUrl ? { logo: { "@type": "ImageObject", url: raw.logoUrl } } : {}) },
        ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}), wordCount: plainText(post.body).split(" ").length, articleSection: post.category?.name,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: raw.name, item: storeUrl(raw) },
          { "@type": "ListItem", position: 2, name: "Blog", item: storeUrl(raw, "/blog") },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <BlogPostView
        store={store} design={design} post={{ ...card, updatedLabel: formatPostDate(post.updatedAt) }} url={url} related={related.map(toCardView)}
        newer={newer} older={older} toc={outline(blocks)} ctaHref={`/store/${slug}/contact`} ctaLabel="Contact us"
      >
        <MarkdownView blocks={blocks} tokens={{ text: design.text, muted: design.muted, accent: design.accent, line: `${design.text}1f`, radius: design.radius, headingFont: design.headingFont }} />
      </BlogPostView>
    </>
  );
}
