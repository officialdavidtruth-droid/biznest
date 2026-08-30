// Route: /store/[slug]/admin/marketing
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarketingEmailComposer } from "@/components/dashboard/marketing-email-composer";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";

export default async function MarketingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return null;

  const [activeSubscribers, subscribers, campaigns, products, services] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { storeId: store.id, unsubscribedAt: null } }),
    prisma.newsletterSubscriber.findMany({ where: { storeId: store.id }, select: { id: true, email: true, createdAt: true, unsubscribedAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailCampaign.findMany({ where: { storeId: store.id }, select: { id: true, subject: true, template: true, status: true, recipientCount: true, sentCount: true, failedCount: true, createdAt: true, sentAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true }, select: { id: true, name: true, description: true, price: true, currency: true, images: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.service.findMany({ where: { storeId: store.id, isPublished: true }, select: { id: true, name: true, description: true, price: true, currency: true, images: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const colors = (store.themeColors as Record<string, string> | null) ?? {};
  const brand: MarketingBrand = {
    name: store.name,
    storeId: store.id,
    slug,
    logoUrl: store.logoUrl,
    bannerUrl: store.bannerUrl,
    primary: colors.primary ?? colors.accent ?? "#111827",
    secondary: colors.secondary ?? "#111827",
    accent: colors.accent ?? colors.primary ?? "#2563eb",
    background: colors.background ?? "#f3f4f6",
    text: colors.text ?? "#111827",
    fontFamily: store.fontFamily ?? "Arial",
    contactEmail: store.contactEmail ?? store.business.email,
    contactPhone: store.contactPhone ?? store.business.phone,
    socialLinks: (store.socialLinks as Record<string, string> | null) ?? null,
    businessType: store.businessType,
    businessDescription: store.business.description,
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
  };

  const items: MarketingItem[] = [
    ...products.map((p) => ({ name: p.name, description: p.description, price: `${p.currency} ${Number(p.price).toLocaleString()}`, imageUrl: p.images[0] ?? null, href: `/${slug}/product/${p.id}` })),
    ...services.map((s) => ({ name: s.name, description: s.description, price: `${s.currency} ${Number(s.price).toLocaleString()}`, imageUrl: s.images[0] ?? null, href: `/${slug}/service/${s.id}` })),
  ].slice(0, 12);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing Studio</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create beautiful, industry-specific emails that automatically look like your business — not a generic BizNest email.</p>
        </div>
        <div className="flex gap-2"><Link href={`/${slug}/admin/customize`} className="rounded-lg border px-3 py-2 text-xs font-medium hover:border-primary">Edit brand</Link><Link href={`/${slug}`} target="_blank" className="rounded-lg border px-3 py-2 text-xs font-medium hover:border-primary">View website ↗</Link></div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Active subscribers" value={activeSubscribers.toLocaleString()} />
        <Stat label="Unsubscribed" value={subscribers.filter((s) => s.unsubscribedAt).length.toLocaleString()} />
        <Stat label="Campaigns sent" value={campaigns.filter((c) => c.status === "SENT" || c.status === "PARTIAL").length.toLocaleString()} />
      </div>

      <MarketingEmailComposer slug={slug} brand={brand} items={items} activeSubscribers={activeSubscribers} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border bg-background p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Subscribers</h2><p className="mt-1 text-xs text-muted-foreground">People who opted into this store&apos;s newsletter.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">{activeSubscribers} active</span></div>
          <div className="max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 border-b bg-muted/60"><tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{subscribers.map((s) => <tr key={s.id} className="border-b last:border-0"><td className="px-3 py-2 font-medium">{s.email}</td><td className="px-3 py-2 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-NG")}</td><td className="px-3 py-2">{s.unsubscribedAt ? <span className="text-muted-foreground">Unsubscribed</span> : <span className="font-medium text-emerald-600">Active</span>}</td></tr>)}{!subscribers.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No subscribers yet. Add the newsletter section to your website to start collecting them.</td></tr>}</tbody></table></div>
        </section>

        <section className="rounded-2xl border bg-background p-5">
          <div className="mb-4"><h2 className="text-sm font-semibold">Campaign history</h2><p className="mt-1 text-xs text-muted-foreground">Every send is recorded here.</p></div>
          <div className="space-y-2">{campaigns.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{c.subject}</p><p className="mt-1 text-[11px] text-muted-foreground">{c.template} · {new Date(c.createdAt).toLocaleDateString("en-NG")}</p></div><div className="shrink-0 text-right"><p className="text-xs font-semibold">{c.sentCount}/{c.recipientCount}</p><p className={`mt-1 text-[10px] font-semibold ${c.status === "SENT" ? "text-emerald-600" : c.status === "FAILED" ? "text-red-600" : "text-amber-600"}`}>{c.status}</p></div></div>)}{!campaigns.length && <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">Your first campaign will appear here.</div>}</div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-background p-4"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
