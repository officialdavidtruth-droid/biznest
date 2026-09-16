import { redirect } from "next/navigation";

/** Legacy compatibility route. Kitchen Operations is now a module inside BizNest FnB. */
export default async function LegacyKitchenOpsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/fnb`);
}
