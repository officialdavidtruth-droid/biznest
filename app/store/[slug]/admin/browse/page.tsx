import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadVendorBrowse, loadVendorStories } from "@/lib/browse-data";
import { BROWSE_DAILY_POST_LIMIT } from "@/lib/browse";
import { BrowseWorkspace } from "@/components/dashboard/browse-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/browse`);
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, status: true, business: { select: { searchVisible: true } }, products: { where: { isPublished: true, archivedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 200 } },
  });
  if (!store) notFound();
  const [data, stories] = await Promise.all([loadVendorBrowse(store.id), loadVendorStories(store.id)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Post updates and products to the public Browse feed. People can like and comment, and tapping a post takes them to your store.</p>
      </div>
      {store.status !== "ACTIVE" && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Your store isn&apos;t active, so new posts are paused.</p>}
      {store.business?.searchVisible === false && <p className="rounded-lg border bg-muted/40 p-3 text-sm">Your business is hidden from public discovery, so your posts won&apos;t appear in the feed. Turn this on in Settings to be listed.</p>}
      <BrowseWorkspace slug={slug} data={data} stories={stories} products={store.products} dailyLimit={BROWSE_DAILY_POST_LIMIT} />
    </div>
  );
}
