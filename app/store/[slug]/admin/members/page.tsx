import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { loadMembersWorkspace } from "@/lib/members-data";
import { membersProfile } from "@/lib/members";
import { MembersWorkspace } from "@/components/dashboard/members-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/members`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, customDomain: true, customDomainStatus: true, business: { select: { category: true } } } });
  if (!store) notFound();
  const profile = membersProfile(store.business?.category);
  const data = await loadMembersWorkspace(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{profile.key === "church" ? "Members and giving" : profile.key === "salon" ? "Clients and packages" : profile.membersLabel}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep a list, bill dues or packages, collect payment online, issue receipts and record visits.</p>
      </div>
      <MembersWorkspace slug={slug} data={data} profile={profile} portalBase={buildStoreUrl(store, "/member/")} giveUrl={buildStoreUrl(store, "/give")} />
    </div>
  );
}
