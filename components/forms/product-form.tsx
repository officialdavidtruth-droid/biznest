"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { createProduct, updateProduct } from "@/lib/actions/product";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Category = { id: string; name: string; parentId: string | null };

export function ProductForm({
  storeSlug,
  categories,
  product,
}: {
  storeSlug: string;
  categories: Category[];
  product?: {
    id: string;
    name: string;
    categoryId: string | null;
    type: "PHYSICAL" | "DIGITAL" | "RENTAL";
    description: string;
    price: unknown;
    compareAtPrice: unknown;
    currency: string;
    images: string[];
    isPublished: boolean;
    inventory: { quantity: number } | null;
    digitalFileUrl: string | null;
    rentalPeriodUnit: string | null;
  };
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productType, setProductType] = useState<ProductInput["type"]>(product?.type ?? "PHYSICAL");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      categoryId: product?.categoryId ?? "",
      type: product?.type ?? "PHYSICAL",
      description: product?.description ?? "",
      price: product ? Number(product.price) : undefined,
      compareAtPrice: product?.compareAtPrice ? Number(product.compareAtPrice) : undefined,
      currency: product?.currency ?? "NGN",
      images: product?.images ?? [],
      isPublished: product?.isPublished ?? true,
      quantity: product?.inventory?.quantity ?? 0,
      digitalFileUrl: product?.digitalFileUrl ?? "",
      rentalPeriodUnit: (product?.rentalPeriodUnit as ProductInput["rentalPeriodUnit"]) ?? undefined,
    },
  });

  const images = watch("images");

  const topLevelCategories = categories.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
    childrenByParent.get(c.parentId)!.push(c);
  }

  async function onSubmit(values: ProductInput) {
    setIsSubmitting(true);
    const result = product
      ? await updateProduct(storeSlug, product.id, values)
      : await createProduct(storeSlug, values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? "Product updated" : "Product created");
    router.push(`/${storeSlug}/admin/products`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Product name</label>
        <input className="input" {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            className="input"
            {...register("type")}
            onChange={(e) => {
              setValue("type", e.target.value as ProductInput["type"]);
              setProductType(e.target.value as ProductInput["type"]);
            }}
          >
            <option value="PHYSICAL">Physical</option>
            <option value="DIGITAL">Digital</option>
            <option value="RENTAL">Rental</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select className="input" {...register("categoryId")}>
            <option value="">Uncategorized</option>
            {topLevelCategories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (all)</option>
                {(childrenByParent.get(c.id) ?? []).map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea className="input min-h-28" {...register("description")} />
        {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Price</label>
          <input type="number" step="0.01" className="input" {...register("price")} />
          {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Compare-at price</label>
          <input type="number" step="0.01" className="input" {...register("compareAtPrice")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Currency</label>
          <input className="input" {...register("currency")} />
        </div>
      </div>

      {productType === "PHYSICAL" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Quantity in stock</label>
          <input type="number" className="input max-w-32" {...register("quantity")} />
        </div>
      )}

      {productType === "DIGITAL" && (
        <Controller
          name="digitalFileUrl"
          control={control}
          render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium">Digital file</label>
              <input
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  const res = await fetch("/api/upload", { method: "POST", body: fd });
                  const { url } = await res.json();
                  field.onChange(url);
                }}
              />
              {field.value && <p className="mt-1 text-xs text-green-600">File attached ✓</p>}
            </div>
          )}
        />
      )}

      {productType === "RENTAL" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Rental period</label>
          <select className="input max-w-40" {...register("rentalPeriodUnit")}>
            <option value="day">Per day</option>
            <option value="week">Per week</option>
            <option value="month">Per month</option>
          </select>
        </div>
      )}

      <Controller
        name="images"
        control={control}
        render={({ field }) => (
          <MultiImageUpload value={field.value} onChange={field.onChange} />
        )}
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isPublished")} />
        Published (visible on your storefront)
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : product ? "Save changes" : "Create product"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}
