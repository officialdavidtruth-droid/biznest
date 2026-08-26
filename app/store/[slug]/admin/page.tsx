import { getStoreCategories } from "@/lib/actions/category";
import { CategoryManager } from "@/components/dashboard/category-manager";

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getStoreCategories(slug);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize your store into categories and subcategories. These belong only to this store.</p>
      </div>
      <CategoryManager slug={slug} initialCategories={categories} />
    </div>
  );
}
