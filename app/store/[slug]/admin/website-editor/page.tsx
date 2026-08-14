import { redirect } from "next/navigation";

// The standalone click-to-edit page has been folded into the unified
// builder at /admin/customize as its "Content" panel, so editing text and
// images no longer requires leaving the Sections & Layout / Template
// screen. Kept as a route (rather than deleted) so old bookmarks/links
// don't 404 — same pattern as /admin/builder's redirect.
export default async function WebsiteEditorRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/customize`);
}
