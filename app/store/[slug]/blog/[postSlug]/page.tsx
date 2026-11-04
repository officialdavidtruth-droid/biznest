import type { Metadata } from "next";
import { renderArticlePage } from "@/lib/storefront/blog-page";
import { articleMetadata } from "@/lib/storefront/blog-metadata";

type Props = { params: Promise<{ slug: string; postSlug: string }> };

// /blog/<handle> serves an article of the store's first blog (kept so links from before blogs/ existed still work).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params;
  return articleMetadata(slug, null, postSlug);
}

export default async function BlogArticleLegacyPage({ params }: Props) {
  const { slug, postSlug } = await params;
  return renderArticlePage(slug, null, postSlug);
}
