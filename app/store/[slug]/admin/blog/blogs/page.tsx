import { notFound } from "next/navigation";
import { getBlogWorkspace } from "@/lib/actions/blog";
import { BlogManager } from "@/components/dashboard/blog-manager";
import { requireBlogApp } from "../_gate";

export default async function ManageBlogsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireBlogApp(slug);
  const data = await getBlogWorkspace(slug);
  if (!data) notFound();
  return <BlogManager slug={slug} data={data} />;
}
