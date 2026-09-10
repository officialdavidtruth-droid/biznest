import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { getFnbDashboard } from "@/lib/actions/fnb";
import { FnbWorkspace } from "./fnb-workspace";
import { notFound, redirect } from "next/navigation";

export async function FnbPluginPage({ slug }: { slug: string }) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "fnb");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);

  const data = await getFnbDashboard(slug);
  if (!data) redirect(`/store/${slug}/admin/apps`);

  return <FnbWorkspace slug={slug} data={data} />;
}