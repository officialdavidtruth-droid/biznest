import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { loadJobsWorkspace } from "@/lib/jobs-data";
import { defaultNiche } from "@/lib/jobs";
import { JobsWorkspace } from "@/components/dashboard/jobs-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/jobs`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true, businessType: true, business: { select: { category: true } } } });
  if (!store) notFound();
  const data = await loadJobsWorkspace(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track each job from booking to completion. Send estimates for approval, bill deposits and balances, and keep customers updated on their own page.</p>
      </div>
      <JobsWorkspace slug={slug} data={data} jobBase={buildStoreUrl(store, "/job/")} defaultNiche={defaultNiche(store.businessType, store.business?.category)} />
    </div>
  );
}
