import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBlogIndex, renderBlogIndex, type BlogSearch } from "@/lib/storefront/blog-page";
import { blogIndexMetadata } from "@/lib/storefront/blog-metadata";

type Props = { params: Promise<{ slug: string; blog: string }>; searchParams: Promise<BlogSearch> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, blog } = await params;
  return blogIndexMetadata(slug, blog, await searchParams);
}

export default async function BlogHandlePage({ params, searchParams }: Props) {
  const { slug, blog } = await params;
  const sp = await searchParams;
  const loaded = await loadBlogIndex(slug, blog, sp);
  if (!loaded) notFound();
  return renderBlogIndex(slug, loaded, sp);
}
