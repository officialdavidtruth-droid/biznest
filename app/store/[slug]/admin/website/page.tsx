// Route: /store/[slug]/admin/website
// "My Website": the one friendly front door to everything about the public site, in plain words.
// Simple mode owners start here and never need to see the technical editors.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, LayoutTemplate, Store as StoreIcon, FileText, ListTree } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeSiteMode } from "@/lib/site-mode";
import { SiteModeToggle } from "@/components/dashboard/site-mode-toggle";

export default async function MyWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) {
    return <div className="bn-admin-page"><p className="text-sm text-muted-foreground">{access.error}</p></div>;
  }

  const store = await prisma.store.findUnique({
    where: { id: access.store.id },
    select: { name: true, siteMode: true, template: { select: { name: true } } },
  });
  if (!store) notFound();

  const base = `/${slug}/admin`;
  const cards = [
    {
      href: `${base}/templates`,
      icon: LayoutTemplate,
      title: "Choose your design",
      text: store.template ? `Your website uses the “${store.template.name}” design. You can switch any time.` : "Pick how your website looks. You can change it any time.",
    },
    {
      href: `${base}/settings`,
      icon: StoreIcon,
      title: "Your business details",
      text: "Your business name, logo, phone number and address.",
    },
    {
      href: `${base}/customize`,
      icon: FileText,
      title: "Edit your pages",
      text: "Change the words and pictures on your website.",
    },
    {
      href: `${base}/menus`,
      icon: ListTree,
      title: "Pages shown in your menu",
      text: "Choose which pages customers can click to from the top of your website.",
    },
  ];

  return (
    <div className="bn-admin-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything about your website, in one place.</p>
        </div>
        <Link
          href={`/${slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          View my website <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-emerald-600/50 hover:bg-muted/30">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
            </span>
          </Link>
        ))}
      </div>

      <SiteModeToggle slug={slug} initialMode={normalizeSiteMode(store.siteMode)} canChange={access.role !== "STAFF"} />
    </div>
  );
}
