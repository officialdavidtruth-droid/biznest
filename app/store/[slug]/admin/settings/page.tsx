import { prisma } from "@/lib/prisma";
import { updateStoreSettings } from "@/lib/actions/store";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const theme = (store.themeColors as Record<string, string> | null) ?? {};
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const save = updateStoreSettings.bind(null, slug);

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>
      <form action={save} className="space-y-6">
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Store details</p>
          <label className="mb-1 block text-xs text-muted-foreground">Store name</label>
          <input name="name" defaultValue={store.name} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">Contact email</label>
          <input name="contactEmail" type="email" defaultValue={store.contactEmail ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">Contact phone</label>
          <input name="contactPhone" defaultValue={store.contactPhone ?? ""} className="w-full rounded-md border px-3 py-1.5 text-sm" />
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Theme colors</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Primary</label>
              <input name="primary" type="color" defaultValue={theme.primary ?? "#0B3D2E"} className="h-9 w-full rounded-md border" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Secondary</label>
              <input name="secondary" type="color" defaultValue={theme.secondary ?? "#F7F5EF"} className="h-9 w-full rounded-md border" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Accent</label>
              <input name="accent" type="color" defaultValue={theme.accent ?? "#D9A441"} className="h-9 w-full rounded-md border" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Social links</p>
          <label className="mb-1 block text-xs text-muted-foreground">Instagram</label>
          <input name="instagram" defaultValue={social.instagram ?? ""} placeholder="https://instagram.com/yourstore" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">WhatsApp</label>
          <input name="whatsapp" defaultValue={social.whatsapp ?? ""} placeholder="2348031234567" className="w-full rounded-md border px-3 py-1.5 text-sm" />
        </div>

        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save changes</button>
      </form>
    </div>
  );
}
