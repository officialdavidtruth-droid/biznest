import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { loadDispatchWorkspace } from "@/lib/dispatch-data";
import { DispatchWorkspace } from "@/components/dashboard/dispatch-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/dispatch`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true } });
  if (!store) notFound();
  const data = await loadDispatchWorkspace(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Book deliveries, assign riders, share tracking links and keep count of cash riders collect.</p>
      </div>
      <DispatchWorkspace slug={slug} data={data} riderBase={buildStoreUrl(store, "/rider/")} trackBase={buildStoreUrl(store, "/track/")} />
    </div>
  );
}
