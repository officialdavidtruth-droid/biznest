import { auth } from "@/lib/auth";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Package, Heart, MapPin, Bell, Calendar, Star, MessageSquare, ArrowLeft, LogOut,
} from "lucide-react";
import { StoreFooter } from "@/components/storefront/store-footer";
import { SignOutButton } from "@/components/forms/sign-out-button";

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
  if (!session?.user?.id || session.user.role !== "CUSTOMER") {
    redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/store/${encodeURIComponent(slug)}/account`);
  }

  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const membership = await requireStoreCustomer(slug);
  if (!membership) notFound();

  const LINKS = [
    { href: `/store/${slug}/account`, label: "My Account", icon: LayoutDashboard },
    { href: `/store/${slug}/orders`, label: "My Orders", icon: Package },
    { href: `/store/${slug}/account/wishlist`, label: "My Wishlist", icon: Heart },
    { href: `/store/${slug}/account/addresses`, label: "My Addresses", icon: MapPin },
    { href: `/store/${slug}/account/loyalty`, label: "My Rewards", icon: Bell },
    { href: `/store/${slug}/account/bookings`, label: "My Appointments", icon: Calendar },
    { href: `/store/${slug}/account/reviews`, label: "My Reviews", icon: Star },
    { href: `/store/${slug}/account/messages`, label: "Support", icon: MessageSquare },
  ];

  const colors = (store.themeColors as { primary?: string; secondary?: string; accent?: string; background?: string; text?: string } | null) ?? {};
  const accent = colors.primary || "#111827";
  const background = colors.background || "#f8fafc";
  const ink = colors.text || "#0f172a";

  return (
    <div className="min-h-screen" style={{ ["--store-accent" as string]: accent, ["--store-bg" as string]: background, ["--store-ink" as string]: ink, backgroundColor: background }}>
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
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: accent }}>My {store.name} Account</p>
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
            <div className="my-1 hidden border-t border-slate-100 md:block" />
            <SignOutButton
              callbackUrl={`/${slug}`}
              className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </SignOutButton>
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <StoreFooter store={store} slug={slug} />
    </div>
  );
}
