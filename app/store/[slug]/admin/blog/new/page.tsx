import { notFound } from "next/navigation";
import { getBlogEditorData } from "@/lib/actions/blog";
import { BlogEditor } from "@/components/dashboard/blog-editor";
import { requireBlogApp } from "../_gate";

export default async function NewBlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireBlogApp(slug);
  const data = await getBlogEditorData(slug);
  if (!data) notFound();
  return <BlogEditor slug={slug} storeName={data.storeName} categories={data.categories} post={null} />;
}
