// Route: /store/[slug]/admin/categories
import { getStoreCategories, getCategoryItemCounts } from "@/lib/actions/category";
import { CategoryManager } from "@/components/dashboard/category-manager";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, itemCounts, store] = await Promise.all([
    getStoreCategories(slug),
    getCategoryItemCounts(slug),
    prisma.store.findUnique({ where: { slug }, select: { business: { select: { category: true } } } }),
  ]);
  const terminology = getBusinessTerminology(store?.business.category);
  return (
    <div className="bn-admin-page">
      <CategoryManager
        slug={slug}
        initialCategories={categories}
        itemCounts={itemCounts}
        terminology={terminology}
        businessCategory={store?.business.category}
      />
    </div>
  );
}
