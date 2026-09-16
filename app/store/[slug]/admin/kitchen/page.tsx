import { redirect } from "next/navigation";

/** Legacy compatibility route. The old standalone kitchen board is retired. */
export default async function LegacyKitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/fnb`);
}
