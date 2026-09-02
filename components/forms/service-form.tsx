"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { serviceSchema, type ServiceInput } from "@/lib/validations/service";
import { createService, updateService } from "@/lib/actions/service";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { getCatalogItemPreset } from "@/lib/catalog-item-presets";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Save, CheckSquare, ChevronRight,
  Star, MessageSquare, Receipt, Lightbulb, CheckCircle2, Clock3,
  Flame, Soup, Users, Ruler, BedDouble, Bath, Sparkles,
  type LucideIcon,
} from "lucide-react";

type Category = { id: string; name: string; parentId: string | null };
type AttrPair = { key: string; value: string };

// Same reserved-key convention as ProductForm: everything the styled
// sections below own is excluded from the free-form "Additional Details"
// list so nothing already saved is silently dropped on re-render.
const RESERVED_ATTR_KEYS = ["tags", "featured", "allowSpecialRequests", "taxable"] as const;

const ICON_MAP: Record<string, LucideIcon> = {
  Clock3, Flame, Soup, Users, Ruler, BedDouble, Bath, Sparkles, Star, MessageSquare, Receipt,
};

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

function fmtDate(d: unknown) {
  if (!d) return "—";
  return new Date(d as string).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ServiceForm({
  storeSlug,
  categories,
  service,
  entityLabel = "Service",
  categoryLabel = "Category",
  businessCategory,
}: {
  storeSlug: string;
  categories: Category[];
  entityLabel?: string;
  categoryLabel?: string;
  // Business niche (Store.business.category) -- drives which optional
  // fields, wording, and tips this form shows, exactly like ProductForm.
  // A hotel niche renders room-style quick specs (guests/size/bed type);
  // a beauty niche renders duration/skill-level specs; anything
  // unrecognized falls back to a sensible generic preset.
  businessCategory?: string | null;
  service?: {
    id: string;
    name: string;
    categoryId: string | null;
    description: string;
    price: unknown;
    currency: string;
    images: string[];
    isPublished: boolean;
    isBookable: boolean;
    durationMins: number | null;
    totalUnits: number | null;
    availability?: unknown;
    attributes?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<"draft" | "publish" | null>(null);
  const preset = useMemo(() => getCatalogItemPreset(businessCategory), [businessCategory]);

  const initialMode: ServiceInput["bookingMode"] = service?.totalUnits ? "units" : service?.isBookable ? "appointment" : "none";
  const [bookingMode, setBookingMode] = useState<ServiceInput["bookingMode"]>(initialMode);

  const rawAttrs = service?.attributes;
  const attrs = (rawAttrs && typeof rawAttrs === "object" && !Array.isArray(rawAttrs) ? rawAttrs : {}) as Record<string, unknown>;
  const [tags, setTags] = useState<string[]>(Array.isArray(attrs.tags) ? (attrs.tags as string[]) : []);
  const [tagDraft, setTagDraft] = useState("");
  const [featured, setFeatured] = useState<boolean>(Boolean(attrs.featured));
  const [allowSpecialRequests, setAllowSpecialRequests] = useState<boolean>(Boolean(attrs.allowSpecialRequests));
  const [taxable, setTaxable] = useState<boolean>(attrs.taxable === undefined ? true : Boolean(attrs.taxable));
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

  const existingAvailability = (service?.availability && typeof service.availability === "object" ? service.availability : {}) as Record<string, [string, string][]>;
  const [workingHours, setWorkingHours] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(() => {
    const v: Record<string, { enabled: boolean; start: string; end: string }> = {};
    for (const d of DAYS) {
      const range = existingAvailability[d.key]?.[0];
      v[d.key] = { enabled: Boolean(range) || (!service && !["sat", "sun"].includes(d.key)), start: range?.[0] ?? "09:00", end: range?.[1] ?? "17:00" };
    }
    return v;
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      categoryId: service?.categoryId ?? "",
      description: service?.description ?? "",
      price: service ? Number(service.price) : undefined,
      currency: service?.currency ?? "NGN",
      images: service?.images ?? [],
      isPublished: service?.isPublished ?? true,
      bookingMode: initialMode,
      durationMins: service?.durationMins ?? 30,
      totalUnits: service?.totalUnits ?? undefined,
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

  async function submit(values: ServiceInput, publish: boolean) {
    setIsSubmitting(publish ? "publish" : "draft");
    const attributes: Record<string, string | number | boolean | string[]> = {
      tags,
      featured,
      allowSpecialRequests,
      taxable,
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

    const availability: Record<string, [string, string][]> = {};
    if (bookingMode === "appointment") {
      for (const d of DAYS) {
        const wh = workingHours[d.key];
        if (wh.enabled && wh.start < wh.end) availability[d.key] = [[wh.start, wh.end]];
      }
    }

    const payload: ServiceInput = { ...values, isPublished: publish, bookingMode, availability, attributes };
    const result = service ? await updateService(storeSlug, service.id, payload) : await createService(storeSlug, payload);
    setIsSubmitting(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(service ? `${entityLabel} updated` : publish ? `${entityLabel} published` : `${entityLabel} saved as draft`);
    router.push(`/${storeSlug}/admin/services`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Header — breadcrumb on the left, save actions on the right, same
          shell as ProductForm / the Add Room mockup. The hamburger/bell/
          avatar belong to the app shell, not this form. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <h1 className="text-xl font-bold">{service ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{entityLabel} Management</span>
            <ChevronRight className="h-3 w-3" />
            <span>{entityLabel}s</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{service ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                <input className="input" maxLength={100} placeholder={`e.g. Your ${entityLabel.toLowerCase()} name`} {...register("name")} />
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

              <div>
                <label className="mb-1 block text-sm font-medium">{categoryLabel}</label>
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
                    placeholder={tags.length === 0 ? "e.g. Popular, Best Seller" : "Add another…"}
                    className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Press Enter to add a tag. Up to 10.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">{entityLabel} Images <span className="text-destructive">*</span></h2>
            <p className="mb-3 text-xs text-muted-foreground">{preset.imagesHint}</p>
            <Controller
              name="images"
              control={control}
              render={({ field }) => <MultiImageUpload value={field.value} onChange={field.onChange} label="" tileSize="lg" />}
            />
            {errors.images && <p className="mt-1 text-xs text-destructive">{errors.images.message}</p>}
          </section>

          {/* Booking — same three modes as ServiceBookingModeField (none /
              appointment / units), restyled to match the card system above.
              "units" is what a hotel room category uses under the hood. */}
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold">Booking</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                { key: "none", label: "Not bookable" },
                { key: "appointment", label: "Appointment" },
                { key: "units", label: "Multiple units" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBookingMode(opt.key)}
                  className={`rounded-lg border px-3.5 py-2 text-xs font-semibold ${bookingMode === opt.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {bookingMode === "none" && (
              <p className="text-xs text-muted-foreground">Customers won't be able to book a time or date for this {entityLabel.toLowerCase()}.</p>
            )}

            {bookingMode === "appointment" && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">Customers pick a single time slot (e.g. a haircut or consultation).</p>
                <div className="mb-4 max-w-56">
                  <label className="mb-1 block text-sm font-medium">Appointment length (minutes)</label>
                  <input type="number" min={5} step={5} className="input" {...register("durationMins")} />
                </div>
                <p className="mb-2 text-sm font-medium">Working hours</p>
                <div className="space-y-2">
                  {DAYS.map((d) => {
                    const wh = workingHours[d.key];
                    return (
                      <div key={d.key} className="flex items-center gap-2">
                        <label className="flex w-16 items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={wh.enabled}
                            onChange={(e) => setWorkingHours((v) => ({ ...v, [d.key]: { ...v[d.key], enabled: e.target.checked } }))}
                          />
                          {d.label}
                        </label>
                        <input
                          type="time"
                          value={wh.start}
                          onChange={(e) => setWorkingHours((v) => ({ ...v, [d.key]: { ...v[d.key], start: e.target.value } }))}
                          className="rounded-md border px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={wh.end}
                          onChange={(e) => setWorkingHours((v) => ({ ...v, [d.key]: { ...v[d.key], end: e.target.value } }))}
                          className="rounded-md border px-2 py-1 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {bookingMode === "units" && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  For a category with several identical, always-available units — e.g. a "Deluxe Room" category with
                  12 rooms. Customers book by date range and see how many units are left; no working hours needed.
                </p>
                <div className="max-w-56">
                  <label className="mb-1 block text-sm font-medium">Number of units</label>
                  <input type="number" min={1} step={1} placeholder="e.g. 12" className="input" {...register("totalUnits")} />
                  {errors.totalUnits && <p className="mt-1 text-xs text-destructive">{errors.totalUnits.message}</p>}
                </div>
              </>
            )}
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
                    <input value={attr.key} onChange={(e) => updateCustomAttr(i, "key", e.target.value)} placeholder="Field name" className="input flex-1" />
                    <input value={attr.value} onChange={(e) => updateCustomAttr(i, "value", e.target.value)} placeholder="Value" className="input flex-1" />
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
                <label className="mb-1 block text-sm font-medium">Currency</label>
                <input className="input" {...register("currency")} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold">{entityLabel} Options</h2>
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

          {service && (
            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold">Status</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Currently</dt><dd className="font-medium">{service.isPublished ? "Published" : "Draft"}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Added on</dt><dd className="font-medium">{fmtDate(service.createdAt)}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{fmtDate(service.updatedAt)}</dd></div>
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
