import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { loadRealEstateWorkspace } from "@/lib/real-estate-data";
import { RealEstateWorkspace } from "@/components/dashboard/real-estate-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/real-estate`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, customDomain: true, customDomainStatus: true } });
  if (!store) notFound();
  const data = await loadRealEstateWorkspace(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rent and properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add tenants, bill rent, collect payment online, issue receipts and track repairs.</p>
      </div>
      <RealEstateWorkspace slug={slug} data={data} portalBase={buildStoreUrl(store, "/rent/")} storeName={store.name} />
    </div>
  );
}
