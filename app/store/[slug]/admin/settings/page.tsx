// Route: /store/[slug]/admin/settings
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStoreSettings } from "@/lib/actions/store";
import { setCustomDomain, recheckDomainStatus, removeCustomDomain } from "@/lib/actions/domain";
import { LogoBannerFields } from "@/components/forms/logo-banner-fields";
import { StoreSlugEditor } from "@/components/dashboard/store-slug-editor";
import { BusinessCapabilitiesEditor } from "@/components/dashboard/business-capabilities-editor";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { listWebhookEndpoints, availableWebhookEvents } from "@/lib/actions/webhook";
import { APP_URL } from "@/lib/constants/app-url";
import { GuideToggle } from "@/components/app/page-guide";
import { TrackingIdsForm } from "@/components/dashboard/tracking-ids-form";
import { sanitizeStoredTrackingIds } from "@/lib/tracking/ids";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { STORE_FONT_OPTIONS, STORE_SETTINGS_LIMITS } from "@/lib/validations/store-settings";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, business: true } });
  if (!store) return null;

  const session = await auth();
  const isOwner = session?.user?.id === store.business.userId;
  // Store URL and custom domain are owner/platform-support only (see assertStoreOwnerAccess).
  const accessRole = session?.user?.id ? await getStoreAccessRole(session.user.id, session.user.role, store) : null;
  const canManageIdentity = accessRole === "OWNER" || accessRole === "PLATFORM_STAFF";

  const theme = (store.themeColors as Record<string, string> | null) ?? {};
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const save = updateStoreSettings.bind(null, slug);

  const features = store.subscription?.features as { customDomain?: boolean } | null;
  const domainUnlocked = Boolean(features?.customDomain);

  const [webhookEndpoints, webhookEventOptions] = await Promise.all([
    listWebhookEndpoints(slug),
    availableWebhookEvents(),
  ]);

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
      <StoreSettingsForm action={save}>
        <LogoBannerFields initialLogo={store.logoUrl ?? ""} initialBanner={store.bannerUrl ?? ""} />
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Store details</p>
          <label className="mb-1 block text-xs text-muted-foreground">Store name</label>
          <input name="name" required maxLength={STORE_SETTINGS_LIMITS.name} defaultValue={store.name} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">Contact email</label>
          <input name="contactEmail" type="email" maxLength={STORE_SETTINGS_LIMITS.contactEmail} defaultValue={store.contactEmail ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">Contact phone</label>
          <input name="contactPhone" maxLength={STORE_SETTINGS_LIMITS.contactPhone} defaultValue={store.contactPhone ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          {isOwner && (
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" name="dailySummaryEmail" defaultChecked={store.dailySummaryEmail} className="mt-1" />
              <span>Email me a daily summary<span className="block text-xs text-muted-foreground">Sales, stock risks and unpaid checkouts, sent each evening to your account email. You always get it in the app too.</span></span>
            </label>
          )}
          <label className="mb-1 block text-xs text-muted-foreground">About your business</label>
          <textarea
            name="description"
            required
            maxLength={STORE_SETTINGS_LIMITS.description}
            defaultValue={store.business.description}
            rows={4}
            placeholder="What you do, what makes you different — this shows on your storefront's About section."
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>

        {isOwner && (
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-1 text-sm font-medium">Customer messages</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Automatic WhatsApp messages to your customers, with SMS as the backup. Every message names your store. Each one is sent only once per order, and only to the phone number the customer gave at checkout. SMS uses credit, so these are off until you switch them on.
            </p>
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" name="msgOrderUpdates" defaultChecked={store.msgOrderUpdates} className="mt-1" />
              <span>Order and delivery updates<span className="block text-xs text-muted-foreground">Payment received, being prepared, ready or on its way (with the tracking link), completed, cancelled.</span></span>
            </label>
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" name="msgAbandonedCart" defaultChecked={store.msgAbandonedCart} className="mt-1" />
              <span>Abandoned cart reminders<span className="block text-xs text-muted-foreground">One reminder when a customer starts checkout but doesn&apos;t pay, with a link back to their cart.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="msgReviewRequests" defaultChecked={store.msgReviewRequests} className="mt-1" />
              <span>Review requests<span className="block text-xs text-muted-foreground">Ask for a review about 3 days after an order is delivered or a booking is completed (by message, and by email when there is one).</span></span>
            </label>
          </div>
        )}

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
          <p className="mb-3 text-sm font-medium">Typography</p>
          <label className="mb-1 block text-xs text-muted-foreground">Body font</label>
          <select name="fontFamily" defaultValue={store.fontFamily ?? ""} className="w-full rounded-md border px-3 py-1.5 text-sm">
            {STORE_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Applies to your storefront's body text.</p>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Social links</p>
          <label className="mb-1 block text-xs text-muted-foreground">Instagram</label>
          <input name="instagram" defaultValue={social.instagram ?? ""} placeholder="https://instagram.com/yourstore" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
          <label className="mb-1 block text-xs text-muted-foreground">Your WhatsApp number</label>
          <input name="whatsapp" defaultValue={social.whatsapp ?? ""} placeholder="0803 123 4567 or +234 803 123 4567" className="w-full rounded-md border px-3 py-1.5 text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Customers chat with you directly on this number. It is your own, never BizNest&apos;s.</p>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" name="whatsappFloat" defaultChecked={(social as Record<string, string | undefined>).whatsappFloat === "on"} />
            Show a floating &ldquo;Chat on WhatsApp&rdquo; button on my storefront
          </label>
        </div>

      </StoreSettingsForm>

      <GuideToggle />

      <div className="mt-6">
        <TrackingIdsForm slug={slug} initial={sanitizeStoredTrackingIds(store)} />
      </div>

      {canManageIdentity && (
        <div className="mt-6">
          <StoreSlugEditor slug={slug} domainRoot={new URL(APP_URL).host.replace(/^www\./, "")} />
        </div>
      )}

      {isOwner && (
        <div className="mt-6">
          <BusinessCapabilitiesEditor
            slug={slug}
            initialSellsProducts={store.business.sellsProducts}
            initialOffersServices={store.business.offersServices}
          />
        </div>
      )}

      {canManageIdentity && (
      <div className="mt-6 rounded-lg border bg-background p-4">
        <p className="mb-1 text-sm font-medium">Custom domain</p>
        {!domainUnlocked ? (
          <p className="text-xs text-muted-foreground">
            Connect your own domain (e.g. yourstore.com) instead of biznest.space/{slug}.
            This is an Enterprise and Business Mogul feature —{" "}
            <a href={`/store/${slug}/admin/subscription`} className="font-medium text-primary hover:underline">upgrade your plan</a> to unlock it.
          </p>
        ) : store.customDomain ? (
          <div className="text-sm">
            <p className="flex items-center gap-2">
              <span className="font-mono">{store.customDomain}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                store.customDomainStatus === "VERIFIED" ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]"
                : store.customDomainStatus === "FAILED" ? "bg-destructive/10 text-destructive"
                : "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]"
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
      )}

      <div className="mt-6">
        <WebhooksPanel slug={slug} endpoints={webhookEndpoints} eventOptions={webhookEventOptions} />
      </div>
    </div>
  );
}
