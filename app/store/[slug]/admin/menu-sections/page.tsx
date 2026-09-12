// Route: /store/[slug]/admin/menu-sections
import { getStoreCategories } from "@/lib/actions/category";
import { MenuSectionsManager } from "@/components/dashboard/menu-sections-manager";
import { prisma } from "@/lib/prisma";

export default async function MenuSectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  const categories = await getStoreCategories(slug);
  const topLevel = categories
    .filter((c) => !c.parentId && c.type === "PRODUCT")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const counts = store
    ? await prisma.product.groupBy({
        by: ["categoryId"],
        where: { storeId: store.id, categoryId: { in: topLevel.map((c) => c.id) } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Menu Sections</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group and order how your menu is laid out for guests.</p>
      </div>

      <MenuSectionsManager
        slug={slug}
        initialSections={topLevel.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, itemCount: countMap.get(c.id) ?? 0 }))}
      />
    </div>
  );
}
