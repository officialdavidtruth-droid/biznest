import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { loadTicketsWorkspace } from "@/lib/tickets-data";
import { TicketsWorkspace } from "@/components/dashboard/tickets-workspace";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/tickets`);
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, customDomain: true, customDomainStatus: true } });
  if (!store) notFound();
  const data = await loadTicketsWorkspace(store.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Event tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create events, sell ticket types online, take door sales, manage the guest list and scan people in at the gate.</p>
      </div>
      <TicketsWorkspace slug={slug} data={data} eventBase={buildStoreUrl(store, "/tickets/")} />
    </div>
  );
}
