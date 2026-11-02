import { notFound } from "next/navigation";
import { getBlogWorkspace } from "@/lib/actions/blog";
import { BlogWorkspace } from "@/components/dashboard/blog-workspace";
import { requireBlogApp } from "./_gate";

export default async function BlogAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireBlogApp(slug);
  const data = await getBlogWorkspace(slug);
  if (!data) notFound();
  return <BlogWorkspace slug={slug} data={data} />;
}
