// Route: /store/[slug]/admin/builder
import { redirect } from "next/navigation";

// "Website builder" (template picker) was a subset of what "Customize
// Website" already does (template picker + section order + live preview),
// so this page now redirects there instead of maintaining a second,
// smaller template picker. Kept as a route (rather than deleted) so old
// bookmarks/links don't 404.
export default async function BuilderRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/admin/customize`);
}
