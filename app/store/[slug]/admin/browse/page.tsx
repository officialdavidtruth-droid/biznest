import { redirect } from "next/navigation";
import { FeedTab } from "@/components/dashboard/browse-tabs";
import type { FeedSort } from "@/lib/browse-data";

export const dynamic = "force-dynamic";

/** The Browse feed. Old ?tab= links still work and land on the matching page. */
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; sort?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (sp.tab === "posts" || sp.tab === "activity") redirect(`/store/${slug}/admin/browse/${sp.tab}`);
  const sort: FeedSort = sp.sort === "popular" ? "popular" : "latest";
  return <FeedTab base={`/store/${slug}/admin/browse`} sort={sort} />;
}
