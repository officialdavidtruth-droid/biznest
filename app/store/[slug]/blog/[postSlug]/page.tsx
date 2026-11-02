import type { Metadata } from "next";
import { getBlogStoreIfActive, renderBlogPostPage } from "@/lib/storefront/blog-page";
import { getBlogPost } from "@/lib/blog-public";
import { absoluteUrl, cleanDescription, NO_INDEX, storeUrl } from "@/lib/seo";
import { excerptFor } from "@/lib/blog";

type Props = { params: Promise<{ slug: string; postSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const raw = await getBlogStoreIfActive(slug);
  const found = raw ? await getBlogPost(raw.id, postSlug) : null;
  if (!raw || !found) return { title: "Not found", robots: NO_INDEX };
  const { post } = found;
  const canonical = storeUrl(raw, `/blog/${post.slug}`);
  const title = post.seoTitle || post.title;
  const description = cleanDescription(post.seoDescription || excerptFor(post));
  const image = absoluteUrl(post.featuredImage);
  return {
    title: `${title} | ${raw.name}`, description, keywords: post.tags.length ? post.tags : undefined,
    robots: raw.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical, types: { "application/rss+xml": storeUrl(raw, "/blog/rss.xml") } },
    openGraph: {
      type: "article", url: canonical, title, description, siteName: raw.name, locale: "en_NG", publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(), authors: [post.authorName], tags: post.tags, ...(image ? { images: [{ url: image, alt: post.featuredImageAlt || post.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug, postSlug } = await params;
  return renderBlogPostPage(slug, postSlug);
}
