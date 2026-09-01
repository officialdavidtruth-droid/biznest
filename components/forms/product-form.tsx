"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { createProduct, updateProduct } from "@/lib/actions/product";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { getCatalogItemPreset } from "@/lib/catalog-item-presets";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Upload, Save, CheckSquare, ChevronRight,
  Star, MessageSquare, Receipt, Lightbulb, CheckCircle2,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link2, ImageIcon, Undo2, Redo2,
  Clock3, Flame, Soup, Users, Ruler, BedDouble, Bath, Sparkles,
  type LucideIcon,
} from "lucide-react";

type Category = { id: string; name: string; parentId: string | null };

type AttrPair = { key: string; value: string };

// Keys that the styled sections below (tags/toggles/quick specs/spec panel/
// detailed description) own -- everything else in attributes lands in the
// free-form "Additional Details" list so nothing a merchant already saved
// is ever silently dropped when this form re-renders.
const RESERVED_ATTR_KEYS = ["tags", "featured", "allowSpecialRequests", "taxable", "availability", "section", "detailedDescription"] as const;

const ICON_MAP: Record<string, LucideIcon> = {
  Clock3, Flame, Soup, Users, Ruler, BedDouble, Bath, Sparkles, Star, MessageSquare, Receipt,
};

function fmtDate(d: unknown) {
  if (!d) return "—";
  return new Date(d as string).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function wrapSelection(
  textarea: HTMLTextAreaElement | null,
  before: string,
  after: string,
  onChange: (v: string) => void,
  current: string
) {
  if (!textarea) return;
  const { selectionStart, selectionEnd } = textarea;
  const selected = current.slice(selectionStart, selectionEnd);
  const next = current.slice(0, selectionStart) + before + selected + after + current.slice(selectionEnd);
  onChange(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
  });
}

function prefixLines(
  textarea: HTMLTextAreaElement | null,
  prefix: (i: number) => string,
  onChange: (v: string) => void,
  current: string
) {
  if (!textarea) return;
  const { selectionStart, selectionEnd } = textarea;
  const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = current.indexOf("\n", selectionEnd);
  const block = current.slice(lineStart, lineEnd === -1 ? current.length : lineEnd);
  const prefixed = block.split("\n").map((line, i) => `${prefix(i)}${line}`).join("\n");
  const next = current.slice(0, lineStart) + prefixed + current.slice(lineEnd === -1 ? current.length : lineEnd);
  onChange(next);
  textarea.focus();
}

export function ProductForm({
  storeSlug,
  categories,
  product,
  entityLabel = "Product",
  categoryLabel = "Category",
  businessCategory,
}: {
  storeSlug: string;
  categories: Category[];
  entityLabel?: string;
  categoryLabel?: string;
  // Business niche (Store.business.category / businessType) -- drives which
  // optional fields, wording, and tips this form shows. See
  // lib/catalog-item-presets.ts. Unrecognized/omitted niches fall back to a
  // sensible generic preset, so this form works for any business type.
  businessCategory?: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState<"draft" | "publish" | null>(null);
  const isMenuItem = entityLabel.toLowerCase().includes("menu");
  const [productType, setProductType] = useState<ProductInput["type"]>(product?.type ?? "PHYSICAL");
  const preset = useMemo(() => getCatalogItemPreset(businessCategory), [businessCategory]);

  const rawAttrs = product?.attributes;
  const attrs = (rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs) ? rawAttrs : {}) as Record<string, unknown>;
  const [tags, setTags] = useState<string[]>(Array.isArray(attrs.tags) ? (attrs.tags as string[]) : []);
  const [tagDraft, setTagDraft] = useState("");
  const [featured, setFeatured] = useState<boolean>(Boolean(attrs.featured));
  const [allowSpecialRequests, setAllowSpecialRequests] = useState<boolean>(Boolean(attrs.allowSpecialRequests));
  const [taxable, setTaxable] = useState<boolean>(attrs.taxable === undefined ? true : Boolean(attrs.taxable));
  const [availability, setAvailability] = useState<string>(typeof attrs.availability === "string" ? attrs.availability : preset.availabilityOptions[0]);
  const [section, setSection] = useState<string>(typeof attrs.section === "string" ? attrs.section : "");
  const [detailedDescription, setDetailedDescription] = useState<string>(typeof attrs.detailedDescription === "string" ? attrs.detailedDescription : "");
  const [quickSpecValues, setQuickSpecValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of preset.quickSpecs) if (typeof attrs[f.key] === "string" || typeof attrs[f.key] === "number") v[f.key] = String(attrs[f.key]);
    return v;
  });
  const [specValues, setSpecValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of preset.specFields) if (typeof attrs[f.key] === "string" || typeof attrs[f.key] === "number") v[f.key] = String(attrs[f.key]);
    return v;
  });
  const [customAttrs, setCustomAttrs] = useState<AttrPair[]>(
    Object.entries(attrs)
      .filter(([k]) => !(RESERVED_ATTR_KEYS as readonly string[]).includes(k))
      .filter(([k]) => !preset.quickSpecs.some((f) => f.key === k) && !preset.specFields.some((f) => f.key === k))
      .map(([key, value]) => ({ key, value: String(value) }))
  );

  const descTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const name = watch("name");
  const shortDescription = watch("description");

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

  const wordCount = detailedDescription.trim() ? detailedDescription.trim().split(/\s+/).length : 0;

  async function submit(values: ProductInput, publish: boolean) {
    setIsSubmitting(publish ? "publish" : "draft");
    const attributes: Record<string, string | number | boolean | string[]> = {
      tags,
      featured,
      allowSpecialRequests,
      taxable,
      availability,
      section,
      detailedDescription,
    };
    for (const f of preset.quickSpecs) {
      const v = quickSpecValues[f.key];
      if (v) attributes[f.key] = v;
    }
    for (const f of preset.specFields) {
      const v = specValues[f.key];
      if (v) attributes[f.key] = v;
    }
    for (const { key, value } of customAttrs) {
      const k = key.trim();
      if (k) attributes[k] = value;
    }
    const payload: ProductInput = { ...values, isPublished: publish, attributes };
    const result = product ? await updateProduct(storeSlug, product.id, payload) : await createProduct(storeSlug, payload);
    setIsSubmitting(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? `${entityLabel} updated` : publish ? `${entityLabel} published` : `${entityLabel} saved as draft`);
    router.push(`/${storeSlug}/admin/products`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Header — breadcrumb on the left, save actions on the right. The
          hamburger/notification bell/avatar in the mockup are the app
          shell's (DashboardSidebar / MobileDashboardChrome), not part of
          this form. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-xl font-bold">{product ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{preset.sectionLabel === "Section" ? "Catalog Management" : `${preset.sectionLabel.replace(/ (Section|Category|Type)$/, "")} Management`}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{entityLabel}s</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{product ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {preset.importLabel && (
            <button type="button" className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> {preset.importLabel}
            </button>
          )}
          <button
            type="button"
            disabled={isSubmitting !== null}
            onClick={handleSubmit((v) => submit(v, false))}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> {isSubmitting === "draft" ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={isSubmitting !== null}
            onClick={handleSubmit((v) => submit(v, true))}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            <CheckSquare className="h-3.5 w-3.5" /> {isSubmitting === "publish" ? "Publishing…" : "Save & Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 flex items-center justify-between text-sm font-medium">
                  <span>{entityLabel} Name <span className="text-destructive">*</span></span>
                  <span className="text-[11px] font-normal text-muted-foreground">{name?.length ?? 0}/100</span>
                </label>
                <input className="input" maxLength={100} placeholder={isMenuItem ? "e.g. Jollof Rice Special" : `e.g. Your ${entityLabel.toLowerCase()} name`} {...register("name")} />
                {errors.name ? (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">A clear and attractive name for your {entityLabel.toLowerCase()}</p>
                )}
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-sm font-medium">
                  <span>Short Description <span className="text-destructive">*</span></span>
                  <span className="text-[11px] font-normal text-muted-foreground">{shortDescription?.length ?? 0}/255</span>
                </label>
                <textarea className="input min-h-20" maxLength={255} placeholder={`Describe your ${entityLabel.toLowerCase()} in a few words…`} {...register("description")} />
                {errors.description ? (
                  <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Brief description that appears in {entityLabel.toLowerCase()} list</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">{categoryLabel} <span className="text-destructive">*</span></label>
                  <select className="input" {...register("categoryId")}>
                    <option value="">Select {categoryLabel.toLowerCase()}</option>
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
                <div>
                  <label className="mb-1 block text-sm font-medium">{preset.sectionLabel}</label>
                  <input className="input" placeholder={`Select ${preset.sectionLabel.toLowerCase()}`} value={section} onChange={(e) => setSection(e.target.value)} list="section-suggestions" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Availability <span className="text-destructive">*</span></label>
                  <select
                    className={`input font-medium ${availability === preset.availabilityOptions[0] ? "text-emerald-600" : "text-amber-600"}`}
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                  >
                    {preset.availabilityOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {preset.quickSpecs.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {preset.quickSpecs.map((f) => {
                    const Icon = ICON_MAP[f.icon];
                    return (
                      <div key={f.key}>
                        <label className="mb-1 block text-sm font-medium">{f.label}</label>
                        {f.type === "select" ? (
                          <div className="relative">
                            {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
                            <select
                              className="input pl-9"
                              value={quickSpecValues[f.key] ?? ""}
                              onChange={(e) => setQuickSpecValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            >
                              <option value="">Select {f.label.toLowerCase()}</option>
                              {f.options?.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="relative">
                            {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
                            <input
                              className="input pl-9 pr-12"
                              type={f.type === "number" ? "number" : "text"}
                              placeholder={f.placeholder}
                              value={quickSpecValues[f.key] ?? ""}
                              onChange={(e) => setQuickSpecValues((v) => ({ ...v, [f.key]: e.target.value }))}
                            />
                            {f.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{f.unit}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Tags (Optional)</label>
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
            <h2 className="text-sm font-bold">{isMenuItem ? "Item Images" : `${entityLabel} Images`} <span className="text-destructive">*</span></h2>
            <p className="mb-3 text-xs text-muted-foreground">{preset.imagesHint}</p>
            <Controller
              name="images"
              control={control}
              render={({ field }) => <MultiImageUpload value={field.value} onChange={field.onChange} label="" tileSize="lg" />}
            />
            {errors.images && <p className="mt-1 text-xs text-destructive">{errors.images.message}</p>}
          </section>

          {productType === "PHYSICAL" && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold">{isMenuItem ? "Stock & Tracking" : "Inventory"}</h2>
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
                  <h2 className="mb-3 text-sm font-bold">Digital file</h2>
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
              <h2 className="mb-3 text-sm font-bold">Rental period</h2>
              <select className="input max-w-40" {...register("rentalPeriodUnit")}>
                <option value="day">Per day</option>
                <option value="week">Per week</option>
                <option value="month">Per month</option>
              </select>
            </section>
          )}

          <div className="hidden sm:block">
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              className="input max-w-56"
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

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-bold">Detailed Description</h2>
            <div className="overflow-hidden rounded-lg border">
              <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
                <select className="mr-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-xs" defaultValue="Paragraph">
                  <option>Paragraph</option>
                  <option>Heading</option>
                </select>
                <span className="mx-1 h-4 w-px bg-border" />
                {[
                  { Icon: Bold, action: () => wrapSelection(descTextareaRef.current, "**", "**", setDetailedDescription, detailedDescription) },
                  { Icon: Italic, action: () => wrapSelection(descTextareaRef.current, "_", "_", setDetailedDescription, detailedDescription) },
                  { Icon: Underline, action: () => wrapSelection(descTextareaRef.current, "<u>", "</u>", setDetailedDescription, detailedDescription) },
                  { Icon: Strikethrough, action: () => wrapSelection(descTextareaRef.current, "~~", "~~", setDetailedDescription, detailedDescription) },
                ].map(({ Icon, action }, i) => (
                  <button key={i} type="button" onClick={action} className="rounded-md p-1.5 hover:bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {[
                  { Icon: List, action: () => prefixLines(descTextareaRef.current, () => "- ", setDetailedDescription, detailedDescription) },
                  { Icon: ListOrdered, action: () => prefixLines(descTextareaRef.current, (i) => `${i + 1}. `, setDetailedDescription, detailedDescription) },
                ].map(({ Icon, action }, i) => (
                  <button key={i} type="button" onClick={action} className="rounded-md p-1.5 hover:bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {[Link2, ImageIcon].map((Icon, i) => (
                  <button key={i} type="button" className="rounded-md p-1.5 hover:bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {[Undo2, Redo2].map((Icon, i) => (
                  <button key={i} type="button" className="rounded-md p-1.5 hover:bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <textarea
                ref={descTextareaRef}
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                placeholder={`Write a longer, richly formatted description of this ${entityLabel.toLowerCase()}…`}
                className="min-h-40 w-full resize-y border-0 p-3.5 text-sm outline-none"
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-muted-foreground">{wordCount} words</p>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold">Additional Details</h2>
              <button type="button" onClick={addCustomAttr} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add field
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Any other custom fields for this {entityLabel.toLowerCase()} not covered above.
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
                      placeholder="Field name"
                      className="input flex-1"
                    />
                    <input
                      value={attr.value}
                      onChange={(e) => updateCustomAttr(i, "value", e.target.value)}
                      placeholder="Value"
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
            <h2 className="mb-3 text-sm font-bold">Pricing</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Price ({watch("currency") || "NGN"}) <span className="text-destructive">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                  <input type="number" step="0.01" placeholder="e.g. 5,500" className="input pl-7" {...register("price")} />
                </div>
                {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Compare at Price ({watch("currency") || "NGN"})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                  <input type="number" step="0.01" placeholder="e.g. 6,000" className="input pl-7" {...register("compareAtPrice")} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Leave empty if no comparison price</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Currency</label>
                <input className="input" {...register("currency")} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold">Item Options</h2>
            <div className="space-y-3.5">
              {[
                { key: "featured", value: featured, set: setFeatured },
                { key: "allowSpecialRequests", value: allowSpecialRequests, set: setAllowSpecialRequests },
                { key: "taxable", value: taxable, set: setTaxable },
              ].map(({ key, value, set }) => {
                const opt = preset.itemOptions.find((o) => o.key === key);
                if (!opt) return null;
                const Icon = ICON_MAP[opt.icon] ?? Star;
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium leading-tight">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.hint}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => set(!value)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? "bg-emerald-500" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {preset.specFields.length > 0 && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold">{preset.specificationsLabel} <span className="font-normal text-muted-foreground">(Optional)</span></h2>
              <p className="mb-3 text-xs text-muted-foreground">{preset.specificationsHint}</p>
              <div className="grid grid-cols-2 gap-3">
                {preset.specFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium">{f.label}{f.unit ? ` (${f.unit})` : ""}</label>
                    <input
                      className="input text-sm"
                      placeholder={f.placeholder}
                      value={specValues[f.key] ?? ""}
                      onChange={(e) => setSpecValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {product && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold">Status</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Currently</dt><dd className="font-medium">{product.isPublished ? "Published" : "Draft"}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Added on</dt><dd className="font-medium">{fmtDate(product.createdAt)}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{fmtDate(product.updatedAt)}</dd></div>
              </dl>
            </section>
          )}

          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-emerald-900">
              <Lightbulb className="h-4 w-4" /> Tips for a Great {entityLabel}
            </h2>
            <ul className="space-y-2">
              {preset.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-xs text-emerald-900/90">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {section && (
        <datalist id="section-suggestions">
          <option value={section} />
        </datalist>
      )}

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
