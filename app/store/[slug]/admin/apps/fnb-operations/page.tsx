import { redirect } from "next/navigation";

export default async function FnbOperationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // F&B is a full-screen vertical workspace, just like PMS. Keeping the
  // canonical UI outside /apps prevents the marketplace layout/sidebar from
  // competing with the heavier operational workspace and avoids nested
  // streaming/navigation crashes.
  redirect(`/store/${slug}/admin/fnb`);
}
