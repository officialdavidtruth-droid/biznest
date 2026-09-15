import { redirect } from "next/navigation";

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // POS is now a plugin-only capability. Keep the legacy route for existing
  // bookmarks, but always send users into the FnB plugin workspace.
  redirect(`/store/${slug}/admin/fnb`);
}
