import { prisma } from "@/lib/prisma";
import { getService, updateService } from "@/lib/actions/service";
import { ServiceImagesField } from "@/components/forms/service-images-field";
import { notFound, redirect } from "next/navigation";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, serviceId } = await params;
  const { error } = await searchParams;

  const [service, categories] = await Promise.all([
    getService(slug, serviceId),
    prisma.category.findMany({ where: { type: "SERVICE" }, orderBy: { name: "asc" } }),
  ]);
  if (!service) notFound();

  const availability = (service.availability as Record<string, [string, string][]> | null) ?? {};

  async function submit(formData: FormData) {
    "use server";
    const result = await updateService(slug, serviceId, formData);
    if (result.success) redirect(`/${slug}/admin/services`);
    redirect(`/${slug}/admin/services/${serviceId}/edit?error=${encodeURIComponent(result.error)}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold">Edit service</h1>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <form action={submit} className="space-y-5">
        <div className="rounded-lg border bg-background p-4">
          <label className="mb-1 block text-xs text-muted-foreground">Service name</label>
          <input name="name" required defaultValue={service.name} placeholder="Bridal makeup session" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <label className="mb-1 block text-xs text-muted-foreground">Category</label>
          <select name="categoryId" defaultValue={service.categoryId ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm">
            <option value="">No category</option>
            {categories.filter((c) => !c.parentId).map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (all)</option>
                {categories.filter((child) => child.parentId === c.id).map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <textarea name="description" rows={3} required defaultValue={service.description} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <label className="mb-1 block text-xs text-muted-foreground">Price (NGN)</label>
          <input name="price" type="number" min="0" step="0.01" required defaultValue={Number(service.price)} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <ServiceImagesField initialImages={service.images} />
        </div>

        <div className="rounded-lg border bg-background p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isBookable" defaultChecked={service.isBookable} />
            Customers can book an appointment for this
          </label>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            If checked, a booking calendar appears on your storefront for this service.
          </p>

          <label className="mb-1 block text-xs text-muted-foreground">Appointment length (minutes)</label>
          <input name="durationMins" type="number" min="5" step="5" defaultValue={service.durationMins ?? 30} className="mb-4 w-full rounded-md border px-3 py-1.5 text-sm" />

          <p className="mb-2 text-xs font-medium">Working hours</p>
          <div className="space-y-2">
            {DAYS.map((d) => {
              const slot = availability[d.key]?.[0];
              return (
                <div key={d.key} className="flex items-center gap-2">
                  <label className="flex w-16 items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`${d.key}-enabled`} defaultChecked={!!slot} />
                    {d.label}
                  </label>
                  <input type="time" name={`${d.key}-start`} defaultValue={slot?.[0] ?? "09:00"} className="rounded-md border px-2 py-1 text-xs" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input type="time" name={`${d.key}-end`} defaultValue={slot?.[1] ?? "17:00"} className="rounded-md border px-2 py-1 text-xs" />
                </div>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={service.isPublished} />
          Published
        </label>

        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save changes</button>
      </form>
    </div>
  );
}
