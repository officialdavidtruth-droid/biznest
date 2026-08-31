import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { Leaf } from "lucide-react";

export function RestaurantReferenceShell({
  children,
  store,
  slug,
  tone = "order",
}: {
  children: React.ReactNode;
  store: any;
  slug: string;
  tone?: "order" | "checkout";
}) {
  const checkout = tone === "checkout";
  return (
    <div className={`restaurant-reference restaurant-reference-${tone}`}>
      <div className="rr-topbar">
        <div className="rr-topbar-left">
          <span>⌖</span><span>{store.address || "2464 Royal Ln. Mesa, New Jersey 45463"}</span>
          <span>☎</span><span>{store.phone || "(000) 1230-0000"}</span>
          <span>✉</span><span>{store.email || "hello@restaurant.com"}</span>
        </div>
        <div className="rr-social">Follow Us:　●　◎　◉　♪　◍</div>
      </div>

      <header className="rr-header">
        <Link href={`/store/${slug}`} className="rr-brand">
          <span className="rr-brand-mark">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <Leaf />}</span>
          <span><strong>{store.name || "FLAVORA"}</strong><small>RESTAURANT</small></span>
        </Link>
        <nav>
          <Link href={`/store/${slug}`}>Home</Link>
          <Link className={tone === "order" ? "is-active" : ""} href={`/store/${slug}/catalog`}>Menu</Link>
          <Link href={`/store/${slug}/hotel/story`}>About Us</Link>
          <Link href={`/store/${slug}/search`}>Reservations</Link>
          <Link href={`/store/${slug}/search`}>Catering</Link>
          <Link href={`/store/${slug}/search`}>Blog</Link>
          <Link href={`/store/${slug}/search`}>Contact Us</Link>
        </nav>
        <div className="rr-actions">
          <AccountLink storeSlug={slug} ink={checkout ? "#064936" : "#201710"} />
          <CartLink storeSlug={slug} accent={checkout ? "#064936" : "#D95316"} ink={checkout ? "#064936" : "#201710"} />
        </div>
      </header>
      {children}
    </div>
  );
}

export function RestaurantReferenceFooter({ store, slug }: { store: any; slug: string }) {
  return (
    <footer className="rr-footer">
      <div className="rr-footer-main">
        <div className="rr-footer-brand">
          <div className="rr-brand rr-brand-footer"><span className="rr-brand-mark">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <Leaf />}</span><span><strong>{store.name || "FLAVORA"}</strong><small>RESTAURANT</small></span></div>
          <p>Good food, great mood. Experience the best dining with exceptional taste and quality.</p>
          <div className="rr-footer-social">●　◎　◉　♪　◍</div>
        </div>
        <div><h4>Quick Links</h4><Link href={`/store/${slug}`}>Home</Link><Link href={`/store/${slug}/catalog`}>Menu</Link><Link href={`/store/${slug}/hotel/story`}>About Us</Link><Link href={`/store/${slug}/search`}>Reservations</Link><Link href={`/store/${slug}/search`}>Catering</Link><Link href={`/store/${slug}/search`}>Blog</Link><Link href={`/store/${slug}/search`}>Contact Us</Link></div>
        <div><h4>Information</h4><Link href={`/store/${slug}/search`}>Delivery Information</Link><Link href={`/store/${slug}/search`}>Terms & Conditions</Link><Link href={`/store/${slug}/search`}>Privacy Policy</Link><Link href={`/store/${slug}/search`}>Refund Policy</Link><Link href={`/store/${slug}/search`}>FAQs</Link></div>
        <div><h4>Contact Us</h4><span>⌖　{store.address || "2464 Royal Ln. Mesa, New Jersey 45463"}</span><span>☎　{store.phone || "(000) 1230-0000"}</span><span>✉　{store.email || "hello@restaurant.com"}</span><span>◷　Mon - Sun: 10AM - 11PM</span></div>
        <div><h4>Subscribe Newsletter</h4><p>Subscribe to get special offers, free giveaways, and updates.</p><input placeholder="Your email address"/><button>Subscribe</button></div>
      </div>
      <div className="rr-footer-bottom"><span>© 2024 {store.name || "Restaurant"}. All Rights Reserved.</span><span>VISA　 🟠　 PayPal　 Pay　 GPay</span></div>
    </footer>
  );
}
