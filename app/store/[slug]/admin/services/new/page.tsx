// Route: /store/[slug]/admin/services/new
import { prisma } from "@/lib/prisma";
import { createService } from "@/lib/actions/service";
import { redirect } from "next/navigation";
import { ServiceImagesField } from "@/components/forms/service-images-field";
import { ServiceBookingModeField } from "@/components/forms/service-booking-mode-field";

export default async function NewServicePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "SERVICE" }, orderBy: { name: "asc" } }) : [];

  async function submit(formData: FormData) {
    "use server";
    const result = await createService(slug, formData);
    if (result.success) redirect(`/${slug}/admin/services`);
    redirect(`/${slug}/admin/services/new?error=${encodeURIComponent(result.error)}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold">Add a service</h1>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <form action={submit} className="space-y-5">
        <div className="rounded-lg border bg-background p-4">
          <label className="mb-1 block text-xs text-muted-foreground">Service name</label>
          <input name="name" required placeholder="Bridal makeup session" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <label className="mb-1 block text-xs text-muted-foreground">Category</label>
          <select name="categoryId" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm">
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
          <textarea name="description" rows={3} required className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <label className="mb-1 block text-xs text-muted-foreground">Price (NGN)</label>
          <input name="price" type="number" min="0" step="0.01" required className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

          <ServiceImagesField />
        </div>

        <ServiceBookingModeField />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked />
          Publish immediately
        </label>

        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create service</button>
      </form>
    </div>
  );
                }
                
