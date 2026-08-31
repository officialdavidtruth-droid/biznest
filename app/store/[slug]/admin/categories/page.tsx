// Route: /store/[slug]/admin/categories
import { getStoreCategories } from "@/lib/actions/category";
import { CategoryManager } from "@/components/dashboard/category-manager";
import { prisma } from "@/lib/prisma";
import { getBusinessTerminology } from "@/lib/business-terminology";

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, store] = await Promise.all([
    getStoreCategories(slug),
    prisma.store.findUnique({ where: { slug }, select: { business: { select: { category: true } } } }),
  ]);
  const terminology = getBusinessTerminology(store?.business.category);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{terminology.category}s</h1>
        <p className="mt-1 text-sm text-muted-foreground">{terminology.categoriesIntro}</p>
      </div>
      <CategoryManager slug={slug} initialCategories={categories} businessCategory={store?.business.category} />
    </div>
  );
}
