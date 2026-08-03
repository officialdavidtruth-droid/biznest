import Link from "next/link";
import { listProducts } from "@/lib/actions/product";
import { DeleteProductButton } from "@/components/dashboard/delete-product-button";

export default async function ProductsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await listProducts(slug);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link
          href={`/store/${slug}/admin/products/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add product
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="flex items-center gap-3 px-4 py-3">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded bg-muted" />
                  )}
                  <span className="font-medium">{p.name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3">{p.currency} {Number(p.price).toLocaleString()}</td>
                <td className="px-4 py-3">{p.inventory?.quantity ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/store/${slug}/admin/products/${p.id}/edit`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton storeSlug={slug} productId={p.id} productName={p.name} />
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No products yet. Add your first one to get your storefront started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
