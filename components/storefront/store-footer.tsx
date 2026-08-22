import Link from "next/link";
import { Mail, Phone, MessageCircle, Instagram, Facebook, Twitter, ArrowRight } from "lucide-react";
import type { StoreBranding } from "@/lib/actions/store-branding";

// Every template's *-chrome.tsx wraps its own themed footer around
// home/product/cart/checkout pages. This is for the generic, non-template
// pages under /store/[slug] (orders, account) that don't go through any
// template chrome. Deliberately a fuller, multi-column layout (brand +
// quick links + contact) rather than a single copyright line, so it
// doesn't feel like an afterthought bolted onto a real page.
export function StoreFooter({ store, slug }: { store: NonNullable<StoreBranding>; slug: string }) {
  const accent = store.themeColors?.primary || "#0f172a";
  const social = store.socialLinks ?? {};

  const quickLinks = [
    { href: `/${slug}`, label: "Home" },
    { href: `/${slug}/account`, label: "My Account" },
    { href: `/${slug}/orders`, label: "My Orders" },
    { href: `/${slug}/cart`, label: "Cart" },
  ];

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              {store.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />
              )}
              <span className="text-base font-bold text-slate-900">{store.name}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Thanks for shopping with {store.name}. Your orders, wishlist and account are always one tap away.
            </p>
            {(social.instagram || social.facebook || social.twitter || social.whatsapp) && (
              <div className="mt-4 flex items-center gap-3">
                {social.whatsapp && (
                  <a href={`https://wa.me/${social.whatsapp}`} aria-label="WhatsApp" className="text-slate-400 transition hover:text-slate-700">
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </a>
                )}
                {social.instagram && (
                  <a href={social.instagram} aria-label="Instagram" className="text-slate-400 transition hover:text-slate-700">
                    <Instagram className="h-[18px] w-[18px]" />
                  </a>
                )}
                {social.facebook && (
                  <a href={social.facebook} aria-label="Facebook" className="text-slate-400 transition hover:text-slate-700">
                    <Facebook className="h-[18px] w-[18px]" />
                  </a>
                )}
                {social.twitter && (
                  <a href={social.twitter} aria-label="Twitter" className="text-slate-400 transition hover:text-slate-700">
                    <Twitter className="h-[18px] w-[18px]" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Quick Links</p>
            <ul className="mt-3 space-y-2">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-900">
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" style={{ color: accent }} />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Get in Touch</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {store.contactPhone && (
                <li>
                  <a href={`tel:${store.contactPhone}`} className="flex items-center gap-2 hover:text-slate-900">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {store.contactPhone}
                  </a>
                </li>
              )}
              {store.contactEmail && (
                <li>
                  <a href={`mailto:${store.contactEmail}`} className="flex items-center gap-2 hover:text-slate-900">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {store.contactEmail}
                  </a>
                </li>
              )}
              {!store.contactPhone && !store.contactEmail && (
                <li className="text-slate-400">Contact details not added yet.</li>
              )}
            </ul>
          </div>

          {/* Powered by */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Powered By</p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              BizNest
            </Link>
            <p className="mt-3 text-xs text-slate-400">The all-in-one storefront platform.</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {store.name}. All rights reserved.</p>
          <p>Built with BizNest</p>
        </div>
      </div>
    </footer>
  );
}
