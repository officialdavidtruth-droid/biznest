// Route: /store/[slug]/admin/tastehouse
// This template is edited in the Website Builder like every other template.
import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/customize`);
}
