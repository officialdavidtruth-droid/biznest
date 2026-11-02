import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { BLOG_PLUGIN_KEY } from "@/lib/blog";

/** The Blog workspace is only for stores that installed the app on an eligible plan and business type. */
export async function requireBlogApp(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, BLOG_PLUGIN_KEY);
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
}
