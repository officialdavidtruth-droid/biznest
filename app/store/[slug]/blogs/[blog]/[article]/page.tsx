import type { Metadata } from "next";
import { renderArticlePage } from "@/lib/storefront/blog-page";
import { articleMetadata } from "@/lib/storefront/blog-metadata";

type Props = { params: Promise<{ slug: string; blog: string; article: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, blog, article } = await params;
  return articleMetadata(slug, blog, article);
}

export default async function ArticlePage({ params }: Props) {
  const { slug, blog, article } = await params;
  return renderArticlePage(slug, blog, article);
}
