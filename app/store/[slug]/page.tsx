import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreForSlug, renderStorefront } from "@/components/storefront/storefront-runtime";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreForSlug(slug);
  if (!store) return {};
  return {
    title: store.seoTitle ?? store.name,
    description: store.seoDescription ?? store.business?.description ?? undefined,
    robots: store.seoNoIndex ? { index: false, follow: false } : undefined,
    alternates: store.customDomain ? { canonical: `https://${store.customDomain}` } : undefined,
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreForSlug(slug);
  if (!store || store.status !== "ACTIVE") notFound();
  return renderStorefront(slug);
}
