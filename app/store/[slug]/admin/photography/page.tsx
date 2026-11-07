import { redirect } from "next/navigation";

// The old photography workspace only created empty "Shoot N" records. Shoots are run as job cards
// (stages, estimates, deposit and balance, client page, final gallery), so send anyone who lands here there.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/jobs`);
}
