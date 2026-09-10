import { notFound, redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import CRMPage from "../crm/page";
import SEOPage from "../seo/page";
import FinancialControlPage from "../financial-control/page";

export default async function PluginPage({ params }: { params: Promise<{ slug: string; pluginKey: string }> }) {
  const { slug, pluginKey } = await params;
  if (pluginKey === "financial-control") return <FinancialControlPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "crm") return <CRMPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "seo") return <SEOPage params={Promise.resolve({ slug })} />;

  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return null;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, pluginKey);
  if (!entitlement.allowed) redirect(`/store/${slug}/admin/apps`);
  if (!entitlement.installed) redirect(`/store/${slug}/admin/apps`);

  return (
    <div className="rounded-2xl border bg-background p-8">
      <h1 className="text-xl font-bold">{entitlement.plugin.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">This app is installed and entitled for this business. Its dedicated workspace is ready for the next implementation phase.</p>
    </div>
  );
}
