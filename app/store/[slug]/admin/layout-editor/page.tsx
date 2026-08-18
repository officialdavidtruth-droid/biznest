import { redirect } from "next/navigation";

// "Storefront Layout" (section reorder/hide) duplicated what "Customize
// Website" already does in one combined screen (template + section order +
// live preview), so this now redirects there. Kept as a route so old
// bookmarks/links don't 404.
export default async function LayoutEditorRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/admin/customize`);
}
