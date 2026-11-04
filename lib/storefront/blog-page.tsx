import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme } from "@/lib/template-themes";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { jsonLdString, storeUrl } from "@/lib/seo";
import { plainText, formatPostDate } from "@/lib/blog";
import { getBlogIndex, getArticle, isBlogActive, toCardView } from "@/lib/blog-public";
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

export type BlogSearch = { page?: string; tag?: string; q?: string };

/** `blogHandle` null = the store's first blog (what /blog shows). */
export async function loadBlogIndex(slug: string, blogHandle: string | null, sp: BlogSearch) {
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) return null;
  const data = await getBlogIndex(raw.id, { blog: blogHandle, page: Number(sp.page) || 1, tag: sp.tag?.slice(0, 40), q: sp.q });
  if (!data) return null;
  return { raw, data };
}

export function renderBlogIndex(slug: string, loaded: NonNullable<Awaited<ReturnType<typeof loadBlogIndex>>>, sp: BlogSearch) {
  const { raw, data } = loaded;
  const { store, design } = look(raw, slug);
  return (
    <BlogIndexView
      store={store} design={design} blog={data.blog} blogs={data.blogs} articles={data.articles.map(toCardView)}
      page={data.page} totalPages={data.totalPages} total={data.total} tags={data.tags}
      activeTag={sp.tag?.slice(0, 40) || null} query={sp.q?.trim().slice(0, 80) ?? ""}
    />
  );
}

export async function renderArticlePage(slug: string, blogHandle: string | null, articleHandle: string) {
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) notFound();
  const found = await getArticle(raw.id, blogHandle, articleHandle);
  if (!found) notFound();
  const { blog, article, related, newer, older } = found;
  const { store, design } = look(raw, slug);
  const blocks = parseMarkdown(article.body);
  const url = storeUrl(raw, `/blogs/${blog.handle}/${article.handle}`);
  const card = toCardView(article);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", headline: article.title, description: article.seoDescription || card.excerpt, mainEntityOfPage: url, url,
        datePublished: article.publishedAt?.toISOString(), dateModified: article.updatedAt.toISOString(),
        ...(article.imageUrl ? { image: article.imageUrl.startsWith("/") ? storeUrl(raw, article.imageUrl) : article.imageUrl } : {}),
        author: { "@type": "Person", name: article.authorName }, publisher: { "@type": "Organization", name: raw.name, ...(raw.logoUrl ? { logo: { "@type": "ImageObject", url: raw.logoUrl } } : {}) },
        ...(article.tags.length ? { keywords: article.tags.join(", ") } : {}), wordCount: plainText(article.body).split(" ").length, articleSection: blog.title,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: raw.name, item: storeUrl(raw) },
          { "@type": "ListItem", position: 2, name: blog.title, item: storeUrl(raw, `/blogs/${blog.handle}`) },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <BlogPostView
        store={store} design={design} blog={blog} post={{ ...card, updatedLabel: formatPostDate(article.updatedAt) }} url={url} related={related.map(toCardView)}
        newer={newer} older={older} toc={outline(blocks)} ctaHref={`/store/${slug}/contact`} ctaLabel="Contact us"
      >
        <MarkdownView blocks={blocks} tokens={{ text: design.text, muted: design.muted, accent: design.accent, line: `${design.text}1f`, radius: design.radius, headingFont: design.headingFont }} />
      </BlogPostView>
    </>
  );
}
