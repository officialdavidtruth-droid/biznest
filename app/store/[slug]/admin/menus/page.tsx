// Route: /store/[slug]/admin/menus
import { getMenuEditorData } from "@/lib/actions/store-menu";
import { MenuManager } from "@/components/dashboard/menu-manager";

export default async function MenusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getMenuEditorData(slug);
  if ("error" in data) return <div className="bn-admin-page"><p className="text-sm text-muted-foreground">{data.error}</p></div>;
  return (
    <div className="bn-admin-page">
      <MenuManager slug={slug} initialTree={data.tree} categories={data.categories} pages={data.pages} hasCustomMenu={data.hasCustomMenu} />
    </div>
  );
}
