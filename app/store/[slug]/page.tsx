import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CartLink } from "@/components/storefront/cart-link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return {};
  return {
    title: store.seoTitle ?? store.name,
    description: store.seoDescription ?? undefined,
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      products: { where: { isPublished: true }, take: 8 },
      services: { where: { isPublished: true }, take: 8 },
    },
  });

  if (!store || store.status !== "ACTIVE") notFound();

  return (
    <div>
      <header
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ backgroundColor: (store.themeColors as { primary?: string } | null)?.primary }}
      >
        <div className="flex items-center gap-3">
          {store.logoUrl && <img src={store.logoUrl} alt={store.name} className="h-8 w-8 rounded" />}
          <h1 className="text-lg font-semibold">{store.name}</h1>
        </div>
        <CartLink storeSlug={slug} />
      </header>

      <section className="px-6 py-10">
        <h2 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Products</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {store.products.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              {p.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt={p.name} className="mb-2 h-24 w-full rounded object-cover" />
              )}
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                {p.currency} {Number(p.price).toLocaleString()}
              </p>
              {p.type === "PHYSICAL" && (
                <AddToCartButton
                  storeSlug={slug}
                  productId={p.id}
                  name={p.name}
                  price={Number(p.price)}
                  currency={p.currency}
                  image={p.images[0] ?? null}
                />
              )}
            </div>
          ))}
          {store.products.length === 0 && (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
        </div>

        <h2 className="mb-4 mt-10 text-sm font-semibold uppercase text-muted-foreground">Services</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {store.services.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {s.currency} {Number(s.price).toLocaleString()}
              </p>
            </div>
          ))}
          {store.services.length === 0 && (
            <p className="text-sm text-muted-foreground">No services yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
