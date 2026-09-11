import { redirect } from "next/navigation";

export default async function LegacyPluginRoute({ params }: { params: Promise<{ slug: string; pluginKey: string }> }) {
  const { slug, pluginKey } = await params;
  redirect(`/store/${slug}/admin/apps/${pluginKey}`);
}
