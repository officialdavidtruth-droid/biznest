import type { Metadata } from "next";
import { getBlogStoreIfActive, type BlogSearch } from "@/lib/storefront/blog-page";
import { getArticle, resolveBlog } from "@/lib/blog-public";
import { absoluteUrl, cleanDescription, NO_INDEX, storeUrl } from "@/lib/seo";
import { excerptFor } from "@/lib/blog";

/** Metadata for a blog index. `blogHandle` null = the store's first blog (/blog). */
export async function blogIndexMetadata(slug: string, blogHandle: string | null, sp: BlogSearch): Promise<Metadata> {
  const raw = await getBlogStoreIfActive(slug);
  if (!raw) return {};
  const blog = await resolveBlog(raw.id, blogHandle);
  if (!blog) return {};
  const canonical = storeUrl(raw, `/blogs/${blog.handle}`);
  const title = `${blog.title} | ${raw.name}`;
  const description = cleanDescription(`News, guides and stories from ${raw.name}.`);
  return {
    title, description,
    // Filtered and searched views are thin duplicates of the main feed.
    robots: raw.seoNoIndex ? NO_INDEX : sp.q || sp.tag || sp.page ? { index: false, follow: true } : undefined,
    alternates: { canonical, types: { "application/rss+xml": storeUrl(raw, "/blog/rss.xml") } },
    openGraph: { type: "website", url: canonical, title, description, siteName: raw.name, locale: "en_NG" },
  };
}

export async function articleMetadata(slug: string, blogHandle: string | null, articleHandle: string): Promise<Metadata> {
  const raw = await getBlogStoreIfActive(slug);
  const found = raw ? await getArticle(raw.id, blogHandle, articleHandle) : null;
  if (!raw || !found) return { title: "Not found", robots: NO_INDEX };
  const { article, blog } = found;
  const canonical = storeUrl(raw, `/blogs/${blog.handle}/${article.handle}`);
  const title = article.seoTitle || article.title;
  const description = cleanDescription(article.seoDescription || excerptFor(article));
  const image = absoluteUrl(article.imageUrl);
  return {
    title: `${title} | ${raw.name}`, description, keywords: article.tags.length ? article.tags : undefined,
    robots: raw.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical, types: { "application/rss+xml": storeUrl(raw, "/blog/rss.xml") } },
    openGraph: {
      type: "article", url: canonical, title, description, siteName: raw.name, locale: "en_NG", publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(), authors: [article.authorName], tags: article.tags, ...(image ? { images: [{ url: image, alt: article.imageAlt || article.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}
