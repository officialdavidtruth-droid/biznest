import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadVendorAds } from "@/lib/ads-data";
import { AdsWorkspace } from "@/components/dashboard/ads-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/ads`);
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true, status: true, business: { select: { searchVisible: true } },
      products: { where: { isPublished: true, archivedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 200 },
      browsePosts: { where: { status: "PUBLISHED" }, select: { id: true, caption: true, images: true }, orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!store) notFound();
  const campaigns = await loadVendorAds(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ads</h1>
        <p className="mt-1 text-sm text-muted-foreground">Promote your business on Browse. Sponsored posts appear in the feed and sponsored stories in the story row, always marked &ldquo;Sponsored&rdquo;. You pay up front and only for what is shown.</p>
      </div>
      {payment === "success" && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Payment received. Your ad is live and will run until its budget or dates run out.</p>}
      {payment === "failed" && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">We couldn&apos;t confirm that payment. If you were charged it will be matched automatically within a few minutes; otherwise try paying again below.</p>}
      {store.status !== "ACTIVE" && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Your store isn&apos;t active, so ads are paused.</p>}
      {store.business?.searchVisible === false && <p className="rounded-lg border bg-muted/40 p-3 text-sm">Your business is hidden from public discovery, so your ads won&apos;t be shown. Turn this on in Settings to be listed.</p>}
      <AdsWorkspace slug={slug} campaigns={campaigns} products={store.products} posts={store.browsePosts} />
    </div>
  );
}
