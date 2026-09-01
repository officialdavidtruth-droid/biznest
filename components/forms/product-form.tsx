"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { createProduct, updateProduct } from "@/lib/actions/product";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; parentId: string | null };

type AttrPair = { key: string; value: string };

const RESERVED_ATTR_KEYS = ["tags", "featured", "allowSpecialRequests", "taxable"] as const;

function fmtDate(d: unknown) {
  if (!d) return "—";
  return new Date(d as string).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ProductForm({
  storeSlug,
  categories,
  product,
  entityLabel = "Product",
  categoryLabel = "Category",
}: {
  storeSlug: string;
  categories: Category[];
  entityLabel?: string;
  categoryLabel?: string;
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
    inventory: { quantity: number; sku: string | null; barcode: string | null } | null;
    digitalFileUrl: string | null;
    rentalPeriodUnit: string | null;
    attributes?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMenuItem = entityLabel.toLowerCase().includes("menu");
  const [productType, setProductType] = useState<ProductInput["type"]>(product?.type ?? "PHYSICAL");

  const rawAttrs = product?.attributes;
  const attrs = (rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs) ? rawAttrs : {}) as Record<string, unknown>;
  const [tags, setTags] = useState<string[]>(Array.isArray(attrs.tags) ? (attrs.tags as string[]) : []);
  const [tagDraft, setTagDraft] = useState("");
  const [featured, setFeatured] = useState<boolean>(Boolean(attrs.featured));
  const [allowSpecialRequests, setAllowSpecialRequests] = useState<boolean>(Boolean(attrs.allowSpecialRequests));
  const [taxable, setTaxable] = useState<boolean>(attrs.taxable === undefined ? true : Boolean(attrs.taxable));
  const [customAttrs, setCustomAttrs] = useState<AttrPair[]>(
    Object.entries(attrs)
      .filter(([k]) => !(RESERVED_ATTR_KEYS as readonly string[]).includes(k))
      .map(([key, value]) => ({ key, value: String(value) }))
  );

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
      sku: product?.inventory?.sku ?? "",
      barcode: product?.inventory?.barcode ?? "",
      digitalFileUrl: product?.digitalFileUrl ?? "",
      rentalPeriodUnit: (product?.rentalPeriodUnit as ProductInput["rentalPeriodUnit"]) ?? undefined,
    },
  });

  const images = watch("images");
  const isPublished = watch("isPublished");

  const topLevelCategories = categories.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
    childrenByParent.get(c.parentId)!.push(c);
  }

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t) || tags.length >= 10) return setTagDraft("");
    setTags((v) => [...v, t]);
    setTagDraft("");
  }
  function addCustomAttr() {
    setCustomAttrs((v) => [...v, { key: "", value: "" }]);
  }
  function updateCustomAttr(i: number, field: "key" | "value", val: string) {
    setCustomAttrs((v) => v.map((a, idx) => (idx === i ? { ...a, [field]: val } : a)));
  }
  function removeCustomAttr(i: number) {
    setCustomAttrs((v) => v.filter((_, idx) => idx !== i));
  }

  async function onSubmit(values: ProductInput) {
    setIsSubmitting(true);
    const attributes: Record<string, string | number | boolean | string[]> = {
      tags,
      featured,
      allowSpecialRequests,
      taxable,
    };
    for (const { key, value } of customAttrs) {
      const k = key.trim();
      if (k) attributes[k] = value;
    }
    const payload: ProductInput = { ...values, attributes };
    const result = product ? await updateProduct(storeSlug, product.id, payload) : await createProduct(storeSlug, payload);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? `${entityLabel} updated` : `${entityLabel} created`);
    router.push(`/${storeSlug}/admin/products`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{entityLabel} name</label>
              <input className="input" {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{isMenuItem ? "Menu item type" : "Type"}</label>
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
                <label className="mb-1 block text-sm font-medium">{categoryLabel}</label>
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
              <label className="mb-1 block text-sm font-medium">Tags</label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => setTags((v) => v.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder={tags.length === 0 ? "e.g. Spicy, Popular, Best Seller" : "Add another…"}
                  className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Press Enter to add a tag. Up to 10.</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">{isMenuItem ? "Menu Description" : "Description"}</h2>
          <textarea className="input min-h-32" {...register("description")} placeholder={`Describe this ${entityLabel.toLowerCase()} for your customers…`} />
          {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold">Item Images</h2>
          <p className="mb-3 text-xs text-muted-foreground">Upload high quality images to make this {entityLabel.toLowerCase()} more appealing.</p>
          <Controller
            name="images"
            control={control}
            render={({ field }) => <MultiImageUpload value={field.value} onChange={field.onChange} label="" />}
          />
          {errors.images && <p className="mt-1 text-xs text-destructive">{errors.images.message}</p>}
        </section>

        {productType === "PHYSICAL" && (
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">{isMenuItem ? "Availability" : "Inventory"}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{isMenuItem ? "Available quantity" : "Quantity in stock"}</label>
                <input type="number" className="input" {...register("quantity")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">SKU</label>
                <input className="input font-mono text-sm" placeholder="Optional" {...register("sku")} />
                {errors.sku && <p className="mt-1 text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Barcode</label>
                <div className="flex gap-1">
                  <input className="input font-mono text-sm" placeholder="Scan or type" {...register("barcode")} />
                  <button
                    type="button"
                    title="Generate a barcode"
                    onClick={() => {
                      const candidate = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
                      setValue("barcode", candidate);
                    }}
                    className="shrink-0 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Generate
                  </button>
                </div>
                {errors.barcode && <p className="mt-1 text-xs text-destructive">{errors.barcode.message}</p>}
              </div>
            </div>
          </section>
        )}

        {productType === "DIGITAL" && (
          <Controller
            name="digitalFileUrl"
            control={control}
            render={({ field }) => (
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Digital file</h2>
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
              </section>
            )}
          />
        )}

        {productType === "RENTAL" && (
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Rental period</h2>
            <select className="input max-w-40" {...register("rentalPeriodUnit")}>
              <option value="day">Per day</option>
              <option value="week">Per week</option>
              <option value="month">Per month</option>
            </select>
          </section>
        )}

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Additional Details</h2>
            <button type="button" onClick={addCustomAttr} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Custom fields for this {entityLabel.toLowerCase()} — e.g. prep time, calories and spice level for a menu item, or bedrooms and area for a property.
          </p>
          {customAttrs.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No custom fields yet.</p>
          ) : (
            <div className="space-y-2">
              {customAttrs.map((attr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={attr.key}
                    onChange={(e) => updateCustomAttr(i, "key", e.target.value)}
                    placeholder="Field name, e.g. Calories"
                    className="input flex-1"
                  />
                  <input
                    value={attr.value}
                    onChange={(e) => updateCustomAttr(i, "value", e.target.value)}
                    placeholder="Value, e.g. 650 kcal"
                    className="input flex-1"
                  />
                  <button type="button" onClick={() => removeCustomAttr(i)} className="shrink-0 rounded-md p-2 text-destructive hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Publishing Status</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">{isPublished ? `This ${entityLabel.toLowerCase()} is visible to your customers` : "Hidden from your storefront"}</p>
            </div>
            <Controller
              name="isPublished"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${field.value ? "bg-emerald-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${field.value ? "left-5" : "left-0.5"}`} />
                </button>
              )}
            />
          </div>
          {product && (
            <dl className="mt-4 space-y-2 border-t pt-4 text-xs">
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Added on</dt><dd className="font-medium">{fmtDate(product.createdAt)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{fmtDate(product.updatedAt)}</dd></div>
            </dl>
          )}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Pricing</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input type="number" step="0.01" className="input" {...register("price")} />
              {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{isMenuItem ? "Previous price (optional)" : "Compare-at price"}</label>
              <input type="number" step="0.01" className="input" {...register("compareAtPrice")} />
              <p className="mt-1 text-xs text-muted-foreground">Leave empty if there's no comparison price.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <input className="input" {...register("currency")} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Item Options</h2>
          <div className="space-y-3">
            {[
              { label: "Featured item", hint: "Show in featured section", value: featured, set: setFeatured },
              { label: "Allow special requests", hint: "Customers can add special notes", value: allowSpecialRequests, set: setAllowSpecialRequests },
              { label: "Taxable item", hint: "This item is subject to tax", value: taxable, set: setTaxable },
            ].map((opt) => (
              <div key={opt.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => opt.set(!opt.value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${opt.value ? "bg-emerald-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${opt.value ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : product ? "Save Changes" : `Create ${entityLabel}`}
        </button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: hsl(var(--background));
        }
      `}</style>
    </form>
  );
}