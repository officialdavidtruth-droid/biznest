import { notFound } from "next/navigation";
import { getBlogEditorData } from "@/lib/actions/blog";
import { BlogEditor } from "@/components/dashboard/blog-editor";
import { requireBlogApp } from "../_gate";

export default async function EditBlogPostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  await requireBlogApp(slug);
  const data = await getBlogEditorData(slug, id);
  if (!data || !data.article) notFound();
  return <BlogEditor key={data.article.id} slug={slug} storeName={data.storeName} blogs={data.blogs} tagSuggestions={data.tagSuggestions} defaultBlogId={data.defaultBlogId} article={data.article} />;
}
