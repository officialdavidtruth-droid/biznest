// Route: /store/[slug]/admin/menus  (?menu=footer for the footer menu)
import { getMenuEditorData } from "@/lib/actions/store-menu";
import { MenuManager } from "@/components/dashboard/menu-manager";

export default async function MenusPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ menu?: string }> }) {
  const { slug } = await params;
  const location = (await searchParams).menu === "footer" ? "footer" : "header";
  const data = await getMenuEditorData(slug, location);
  if ("error" in data) return <div className="bn-admin-page"><p className="text-sm text-muted-foreground">{data.error}</p></div>;
  return (
    <div className="bn-admin-page">
      <MenuManager key={location} slug={slug} location={location} initialTree={data.tree} categories={data.categories} pages={data.pages} pageOptions={data.pageOptions} hasCustomMenu={data.hasCustomMenu} suggested={data.suggested} />
    </div>
  );
}
