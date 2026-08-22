import { auth } from "@/lib/auth";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Package, Heart, MapPin, Bell, ArrowLeft,
} from "lucide-react";
import { StoreFooter } from "@/components/storefront/store-footer";

// Store-scoped "My Account" shell (Jumia-style sidebar). Customer accounts
// are now scoped to a single store (see StoreCustomer), so this whole
// section lives under /store/[slug]/account rather than the old generic
// /account -- themed with that store's own logo/name instead of BizNest's.

export default async function StoreAccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/${slug}/account`);

  const store = await getStoreBranding(slug);
  if (!store) notFound();

  const LINKS = [
    { href: `/${slug}/account`, label: "Account Overview", icon: LayoutDashboard },
    { href: `/${slug}/orders`, label: "Orders", icon: Package },
    { href: `/account/wishlist`, label: "Wishlist", icon: Heart },
    { href: `/account/addresses`, label: "Address Book", icon: MapPin },
    { href: `/account/loyalty`, label: "Loyalty Points", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/${slug}`}
            aria-label="Back to store"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">My {store.name} Account</p>
            <p className="text-sm text-slate-600">Signed in as {session.user.email ?? session.user.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
          <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 md:flex-col md:overflow-visible">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <StoreFooter store={store} slug={slug} />
    </div>
  );
}
