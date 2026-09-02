import React from "react";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { getSignatureTheme } from "@/lib/template-themes";

type Props = {
  store: any;
  slug: string;
  templateName: string;
  children: React.ReactNode;
  crumbs?: React.ReactNode;
  title?: string;
  eyebrow?: string;
};

export function SignatureJourney({ store, slug, templateName, children, crumbs, title }: Props) {
  const t = getSignatureTheme(templateName);
  const mode = t.signatureMode;
  const hotel = ["hotel", "maison", "great-treasure", "grand-vere"].includes(mode);
  const food = ["ember", "tastehouse", "flavora-kitchen", "flavora-restaurant", "harvest"].includes(mode);
  const beauty = ["bloom", "belora", "muse"].includes(mode);
  const reference = ["great-treasure", "grand-vere", "belora", "tastehouse", "flavora-kitchen", "flavora-restaurant"].includes(mode);
  const dark = ["great-treasure", "ember", "flavora-restaurant"].includes(mode);

  const css = {
    "--sig-bg": t.bg,
    "--sig-ink": t.ink,
    "--sig-card": t.card,
    "--sig-accent": t.accent,
    "--sig-muted": t.muted || `${t.ink}99`,
    "--sig-border": t.border || `${t.ink}18`,
    "--sig-radius": t.radius,
    "--sig-font": t.font,
    "--sig-headline": t.headlineFont,
    "--sig-surface-dark": t.surfaceDark || t.ink,
  } as React.CSSProperties;

  const primaryLabel = hotel ? "Book Now" : food ? "Order Now" : beauty ? "Shop Now" : "Explore";
  const primaryHref = hotel ? `/store/${slug}/hotel/rooms` : `/store/${slug}/catalog`;

  return (
    <div className={`signature-journey signature-${mode} ${reference ? "signature-reference" : ""} ${dark ? "signature-dark-theme" : ""}`} style={css} data-signature-mode={mode}>
      {reference && (
        <div className="sj-topbar">
          <span>{hotel ? "Luxury hospitality · Direct reservations" : food ? "Fresh flavors · Order direct" : "Thoughtful beauty · Shop direct"}</span>
          <span className="sj-topbar-contact">{store.phone || store.email || "Welcome"}</span>
        </div>
      )}

      <header className="sj-header">
        <div className="sj-inner">
          <Link href={`/store/${slug}`} className="sj-brand">
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span>{store.name?.[0]}</span>}
            <strong>{store.name}</strong>
          </Link>

          <nav aria-label="Store navigation">
            <Link href={`/store/${slug}`}>Home</Link>
            <Link href={hotel ? `/store/${slug}/hotel/rooms` : `/store/${slug}/catalog`}>{hotel ? "Rooms & Suites" : food ? "Menu" : beauty ? "Beauty" : "Shop"}</Link>
            {hotel && (
              <>
                <Link href={`/store/${slug}/hotel/experience`}>Amenities</Link>
                <Link href={`/store/${slug}/hotel/gallery`}>Gallery</Link>
                <Link href={`/store/${slug}/hotel/story`}>About Us</Link>
              </>
            )}
            {food && <Link href={`/store/${slug}/search`}>Offers</Link>}
            <Link href={`/store/${slug}/account`}>Account</Link>
          </nav>

          <div className="sj-actions">
            {store.sellsProducts && <CartLink storeSlug={slug} accent={t.accent} ink={t.ink} />}
            <AccountLink storeSlug={slug} ink={t.ink} />
            <Link href={primaryHref} className="sj-primary-cta">{primaryLabel}</Link>
          </div>
        </div>
      </header>

      <div className="sj-body">
        {(crumbs || title) && (
          <div className="sj-breadcrumb">
            {crumbs || <><Link href={`/store/${slug}`}>Home</Link><span>›</span><b>{title}</b></>}
          </div>
        )}
        {children}
      </div>

      <footer className="sj-footer">
        <div>
          <div className="sj-brand"><span>{store.name?.[0]}</span><strong>{store.name}</strong></div>
          <p>{store.business?.description || "Quality, service and experiences designed around you."}</p>
        </div>
        <div><b>Explore</b><Link href={`/store/${slug}`}>Home</Link><Link href={hotel ? `/store/${slug}/hotel/rooms` : `/store/${slug}/catalog`}>{hotel ? "Rooms & Suites" : food ? "Menu" : "Catalog"}</Link>{hotel && <Link href={`/store/${slug}/hotel/gallery`}>Gallery</Link>}<Link href={`/store/${slug}/account`}>Account</Link></div>
        <div><b>Contact</b><span>{store.phone || "Contact available in store settings"}</span><span>{store.email || "Email available in store settings"}</span></div>
        <div><b>Stay in the loop</b><span>New offers, updates and announcements.</span></div>
      </footer>
    </div>
  );
}
