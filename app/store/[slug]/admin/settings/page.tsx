import { prisma } from "@/lib/prisma";
import { updateStoreSettings } from "@/lib/actions/store";
import { setCustomDomain, recheckDomainStatus, removeCustomDomain } from "@/lib/actions/domain";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, business: true } });
  if (!store) return null;

  const theme = (store.themeColors as Record<string, string> | null) ?? {};
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const save = updateStoreSettings.bind(null, slug);

  const features = store.subscription?.features as { customDomain?: boolean } | null;
  const domainUnlocked = Boolean(features?.customDomain);

  // <form action> requires void | Promise<void>; the domain actions return
  // ActionResult for other callers, so bind through thin void-returning
  // wrappers here — same pattern used everywhere else in this file's
  // sibling admin pages (see admin/page.tsx, supaadmin/domains/page.tsx).
  async function saveDomain(formData: FormData) {
    "use server";
    await setCustomDomain(slug, formData);
  }
  async function recheck() {
    "use server";
    await recheckDomainStatus(slug);
  }
  async function remove() {
    "use server";
    await removeCustomDomain(slug);
  }

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
          <input name="contactPhone" defaultValue={store.contactPhone ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">About your business</label>
          <textarea
            name="description"
            defaultValue={store.business.description}
            rows={4}
            placeholder="What you do, what makes you different — this shows on your storefront's About section."
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
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

      <div className="mt-6 rounded-lg border bg-background p-4">
        <p className="mb-1 text-sm font-medium">Custom domain</p>
        {!domainUnlocked ? (
          <p className="text-xs text-muted-foreground">
            Connect your own domain (e.g. yourstore.com) instead of biznest.space/store/{slug}.
            This is an Enterprise and Business Mogul feature —{" "}
            <a href={`/store/${slug}/admin/subscription`} className="font-medium text-primary hover:underline">upgrade your plan</a> to unlock it.
          </p>
        ) : store.customDomain ? (
          <div className="text-sm">
            <p className="flex items-center gap-2">
              <span className="font-mono">{store.customDomain}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                store.customDomainStatus === "VERIFIED" ? "bg-green-100 text-green-700"
                : store.customDomainStatus === "FAILED" ? "bg-destructive/10 text-destructive"
                : "bg-yellow-100 text-yellow-700"
              }`}>
                {store.customDomainStatus}
              </span>
            </p>
            {store.customDomainStatus !== "VERIFIED" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Point your domain's DNS to Vercel: add a <code className="rounded bg-muted px-1">CNAME</code> record
                for <code className="rounded bg-muted px-1">{store.customDomain}</code> targeting{" "}
                <code className="rounded bg-muted px-1">cname.vercel-dns.com</code>. DNS changes can take up to
                24–48 hours to propagate.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <form action={recheck}><button className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">Re-check status</button></form>
              <form action={remove}><button className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">Remove domain</button></form>
            </div>
          </div>
        ) : (
          <form action={saveDomain} className="mt-2 flex gap-2">
            <input name="domain" placeholder="yourstore.com" className="flex-1 rounded-md border px-3 py-1.5 text-sm" />
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Connect</button>
          </form>
        )}
      </div>
    </div>
  );
}
