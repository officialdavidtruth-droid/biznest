// Route: /store/[slug]/admin/settings
import { customerMessagingEnabled } from "@/lib/customer-messaging";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStoreSettings } from "@/lib/actions/store";
import { setCustomDomain, recheckDomainStatus, removeCustomDomain } from "@/lib/actions/domain";
import { LogoBannerFields } from "@/components/forms/logo-banner-fields";
import { StoreSlugEditor } from "@/components/dashboard/store-slug-editor";
import { BusinessCapabilitiesEditor } from "@/components/dashboard/business-capabilities-editor";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { planAllows, type PlanFeatures } from "@/lib/entitlements/plan-features";
import { listWebhookEndpoints, availableWebhookEvents } from "@/lib/actions/webhook";
import { redirect } from "next/navigation";
import { checkDomainStatus } from "@/lib/vercel-domains";
import { dnsInstructionFor } from "@/lib/domain-dns";
import { APP_URL } from "@/lib/constants/app-url";
import { GuideToggle } from "@/components/app/page-guide";
import { TrackingIdsForm } from "@/components/dashboard/tracking-ids-form";
import { sanitizeStoredTrackingIds } from "@/lib/tracking/ids";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { DemoNicheSwitcher } from "@/components/dashboard/demo-store-forms";
import { isDemoStoreSlug } from "@/lib/demo-store";
import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";
import { STORE_FONT_OPTIONS, STORE_SETTINGS_LIMITS } from "@/lib/validations/store-settings";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const checked = (await searchParams).domainCheck;
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true, business: true } });
  if (!store) return null;

  const session = await auth();
  const isOwner = session?.user?.id === store.business.userId;
  const messagingOn = customerMessagingEnabled();
  // Store URL and custom domain are owner/platform-support only (see assertStoreOwnerAccess).
  const accessRole = session?.user?.id ? await getStoreAccessRole(session.user.id, session.user.role, store) : null;
  const canManageIdentity = accessRole === "OWNER" || accessRole === "PLATFORM_STAFF";

  const theme = (store.themeColors as Record<string, string> | null) ?? {};
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  const save = updateStoreSettings.bind(null, slug);

  const features = store.subscription?.features as { customDomain?: boolean } | null;
  const domainUnlocked = Boolean(features?.customDomain);
  const webhooksUnlocked = planAllows(store.subscription?.features as PlanFeatures, "webhooks", store.subscription?.name);

  const liveDomain = store.customDomain && store.customDomainStatus !== "VERIFIED" ? await checkDomainStatus(store.customDomain).catch(() => null) : null;
  const txtRecords = liveDomain && liveDomain.ok ? (liveDomain.verification ?? []).filter((v) => v.type === "TXT") : [];

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
    const r = await recheckDomainStatus(slug);
    const outcome = !r.success ? "error" : (r as { verified?: boolean }).verified ? "verified" : "pending";
    redirect(`/store/${slug}/admin/settings?domainCheck=${outcome}#custom-domain`);
  }
  async function remove() {
    "use server";
    await removeCustomDomain(slug);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>
      {/* Only the official BizNest demo store gets this. Every other store never sees it. */}
      {isDemoStoreSlug(slug) && (
        <div className="mb-6">
          <DemoNicheSwitcher slug={slug} current={store.businessType} niches={ALL_BUSINESS_TYPE_NAMES} />
        </div>
      )}
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
            <p className="mb-1 text-sm font-medium">{messagingOn ? "Customer messages" : "Review requests"}</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {messagingOn
                ? "Automatic WhatsApp messages to your customers, with SMS as the backup. Every message names your store. Each one is sent only once per order, and only to the phone number the customer gave at checkout. SMS uses credit, so these are off until you switch them on."
                : "Automatically email customers asking for a review. Sent once, under your store's name."}
            </p>
            {messagingOn && (
              <>
                <label className="mb-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" name="msgOrderUpdates" defaultChecked={store.msgOrderUpdates} className="mt-1" />
                  <span>Order and delivery updates<span className="block text-xs text-muted-foreground">Payment received, being prepared, ready or on its way (with the tracking link), completed, cancelled.</span></span>
                </label>
                <label className="mb-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" name="msgAbandonedCart" defaultChecked={store.msgAbandonedCart} className="mt-1" />
                  <span>Abandoned cart reminders<span className="block text-xs text-muted-foreground">One reminder when a customer starts checkout but doesn&apos;t pay, with a link back to their cart.</span></span>
                </label>
              </>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="msgReviewRequests" defaultChecked={store.msgReviewRequests} className="mt-1" />
              <span>Review requests<span className="block text-xs text-muted-foreground">Ask for a review about 3 days after an order is delivered or a booking is completed{messagingOn ? " (by message, and by email when there is one)" : ""}.</span></span>
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
      <div id="custom-domain" className="mt-6 scroll-mt-20 rounded-lg border bg-background p-4">
        <p className="mb-1 text-sm font-medium">Custom domain</p>
        {!domainUnlocked ? (
          <p className="text-xs text-muted-foreground">
            Connect your own domain (e.g. yourstore.com) instead of biznest.space/{slug}.
            This is an Entrepreneurship and Business Mogul feature —{" "}
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
            {checked && (
              <p role="status" className={`mt-2 rounded-md p-2.5 text-xs font-medium ${checked === "verified" ? "bg-emerald-50 text-emerald-700" : checked === "error" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                {checked === "verified" ? "Checked just now: your domain is verified and live." : checked === "error" ? "The check could not run. Try again in a minute." : "Checked just now: not verified yet. Your DNS changes have not been detected. Follow the steps below, wait a few minutes, then check again."}
              </p>
            )}
            {store.customDomainStatus !== "VERIFIED" && (() => {
              const dns = dnsInstructionFor(store.customDomain!);
              return (
                <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-xs">
                  <p className="text-sm font-semibold">Connect your domain in 3 steps</p>
                  <ol className="mt-3 space-y-3">
                    <li><b>1. Open your DNS settings.</b> Log in where you bought <span className="font-mono">{store.customDomain}</span> (Namecheap, GoDaddy, Cloudflare, Whogohost, etc.) and open <i>DNS</i> or <i>Manage DNS</i>.</li>
                    <li>
                      <b>2. Add this record.</b>{dns.isRoot ? " Delete any existing A or CNAME record for @ first." : " Delete any existing record for this name first."}
                      <div className="mt-2 overflow-hidden rounded-md border bg-background">
                        <div className="grid grid-cols-3 border-b bg-muted/50 px-3 py-1.5 font-semibold"><span>Type</span><span>Name / Host</span><span>Value / Points to</span></div>
                        <div className="grid grid-cols-3 px-3 py-2 font-mono"><span>{dns.recordType}</span><span>{dns.host}</span><span className="break-all">{dns.value}</span></div>
                      </div>
                      <p className="mt-1.5 text-muted-foreground">
                        {dns.isRoot
                          ? "This is a main (root) domain, so it needs an A record. A CNAME will not work on a root domain. Some providers show the name as @ or leave it blank."
                          : "This is a subdomain, so it uses a CNAME record. Leave Proxy off if your provider (e.g. Cloudflare) shows an orange cloud."}
                      </p>
                    </li>
                    {txtRecords.length > 0 && (
                      <li>
                        <b>2b. Also add this ownership record.</b> Vercel needs proof you own this domain.
                        {txtRecords.map((t) => (
                          <div key={t.domain} className="mt-2 overflow-hidden rounded-md border bg-background">
                            <div className="grid grid-cols-3 border-b bg-muted/50 px-3 py-1.5 font-semibold"><span>Type</span><span>Name / Host</span><span>Value</span></div>
                            <div className="grid grid-cols-3 px-3 py-2 font-mono"><span>TXT</span><span className="break-all">{t.domain.replace(`.${store.customDomain}`, "")}</span><span className="break-all">{t.value}</span></div>
                          </div>
                        ))}
                      </li>
                    )}
                    <li><b>3. Save, wait, then press Re-check status.</b> It usually works in 5–30 minutes, but can take up to 24 hours. The status changes from PENDING to VERIFIED.</li>
                  </ol>
                  <details className="mt-3 rounded-md border bg-background p-3">
                    <summary className="cursor-pointer font-semibold">Where do I click? Steps for common hosts</summary>
                    <ul className="mt-2 space-y-2 text-muted-foreground">
                      <li><b className="text-foreground">Namecheap:</b> Domain List → Manage → Advanced DNS → Add New Record.</li>
                      <li><b className="text-foreground">GoDaddy:</b> My Products → DNS next to your domain → Add New Record.</li>
                      <li><b className="text-foreground">Cloudflare:</b> select the domain → DNS → Records → Add record. Set Proxy status to "DNS only" (grey cloud).</li>
                      <li><b className="text-foreground">Whogohost / Qservers / Web4Africa / other Nigerian hosts:</b> log in → Domains → Manage DNS (or DNS Zone Editor in cPanel) → Add Record.</li>
                      <li><b className="text-foreground">Domain is also hosting a website (cPanel, WordPress, Wix, etc.):</b> the DNS record lives at your <i>domain registrar</i> or nameserver provider, not inside the website builder. Changing it will take that website offline.</li>
                      <li>Can't find it? Ask your host's support: "Please add an {dns.recordType} record for {dns.host} pointing to {dns.value}."</li>
                    </ul>
                  </details>
                  <p className="mt-3 rounded-md bg-[var(--bn-admin-orange-soft)] p-2.5 text-[var(--bn-admin-orange-dark)]">
                    Heads up: if this domain already shows another website, that site will switch to your store as soon as the record changes.
                    To keep it, press Remove domain and use a different one (a subdomain like <span className="font-mono">shop.{store.customDomain}</span> works well).
                  </p>
                </div>
              );
            })()}
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
        {webhooksUnlocked ? (
          <WebhooksPanel slug={slug} endpoints={webhookEndpoints} eventOptions={webhookEventOptions} />
        ) : (
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-1 text-sm font-medium">Webhooks</p>
            <p className="text-xs text-muted-foreground">
              Send live order and payment events to your own systems. This is a Business Mogul feature —{" "}
              <a href={`/store/${slug}/admin/subscription`} className="font-medium text-primary hover:underline">upgrade your plan</a> to unlock it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
