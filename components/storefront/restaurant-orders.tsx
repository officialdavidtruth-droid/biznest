"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { useCart } from "@/lib/cart-context";
import { RestaurantHeader, RestaurantFooter, RestaurantBanner } from "@/components/storefront/restaurant-chrome";

export type RestOrder = {
  id: string; shortId: string; status: string; totalLabel: string; placedTitle: string;
  delivery: string | null; trackingUrl: string | null;
  items: { id: string | null; kind: "product" | "service" | null; name: string; image: string | null; qty: number; price: number; currency: string; hasVariants: boolean }[];
};
const STEPS = ["Order Placed", "Preparing", "On the Way", "Delivered"];
const ACTIVE = ["PAID", "IN_PROGRESS"], DONE = ["DELIVERED", "COMPLETED"];
const phase = (s: string) => (ACTIVE.includes(s) ? "ongoing" : DONE.includes(s) ? "completed" : "cancelled");
const stepOf = (o: RestOrder) => (DONE.includes(o.status) ? 3 : o.delivery === "PICKED_UP" || o.delivery === "OUT_FOR_DELIVERY" ? 2 : o.status === "IN_PROGRESS" ? 1 : 0);
const LABEL: Record<string, string> = { PAID: "Order Placed", IN_PROGRESS: "Preparing", DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled", REFUNDED: "Refunded", DISPUTED: "Disputed" };

export function RestaurantOrders({ store, slug, orders, awaiting }: { store: any; slug: string; orders: RestOrder[]; awaiting: { id: string; label: string; note: string }[] }) {
  const [tab, setTab] = useState<"all" | "ongoing" | "completed" | "cancelled">("all");
  const { addItem } = useCart();
  const router = useRouter();
  const count = (t: string) => (t === "all" ? orders.length : orders.filter((o) => phase(o.status) === t).length);
  const shown = useMemo(() => (tab === "all" ? orders : orders.filter((o) => phase(o.status) === tab)), [orders, tab]);
  const ongoing = shown.filter((o) => phase(o.status) === "ongoing");
  const rest = shown.filter((o) => phase(o.status) !== "ongoing");
  const banner = orders.flatMap((o) => o.items).find((i) => i.image)?.image || store.bannerUrl || null;

  const reorder = (o: RestOrder) => {
    const lines = o.items.filter((i) => i.id && i.kind === "product");
    if (!lines.length) return;
    if (lines.some((i) => i.hasVariants)) return router.push(href(slug, `/product/${lines[0].id}`));
    lines.forEach((i) => addItem(slug, { productId: i.id!, name: i.name, price: i.price, currency: i.currency, image: i.image ?? undefined } as any, i.qty));
    router.push(href(slug, "/cart"));
  };
  const Card = ({ o }: { o: RestOrder }) => {
    const ph = phase(o.status), st = stepOf(o);
    return (
      <article className={`rs-order ${ph}`}>
        <header>
          <div>
            <b>Order #{o.shortId}</b>
            <small>{o.placedTitle}</small>
          </div>
          <span className={`rs-pill ${ph}`}>{LABEL[o.status] ?? o.status}</span>
        </header>
        <div className="rs-order-items">
          {o.items.slice(0, 4).map((i, n) => (
            <div key={n} className="rs-oi">
              <i style={i.image ? { backgroundImage: `url(${i.image})` } : undefined} />
              <span>{i.name}<small>× {i.qty}</small></span>
            </div>
          ))}
          {o.items.length > 4 && <small>+{o.items.length - 4} more</small>}
        </div>
        {ph === "ongoing" && (
          <ol className="rs-steps">
            {STEPS.map((s, n) => <li key={s} className={n < st ? "done" : n === st ? "now" : ""}><i>{n < st ? <Check size={14} /> : n + 1}</i><span>{s}</span></li>)}
          </ol>
        )}
        <footer>
          <strong>{o.totalLabel}</strong>
          <div>
            {ph === "ongoing" && o.trackingUrl && <a className="rs-btn ghost" href={o.trackingUrl} target="_blank" rel="noopener noreferrer">Track</a>}
            {ph !== "ongoing" && o.items.some((i) => i.kind === "product") && <button className="rs-btn" onClick={() => reorder(o)}>Reorder</button>}
            <Link className="rs-btn ghost" href={href(slug, `/orders/${o.id}/confirmation`)}>View Details <ChevronRight size={15} /></Link>
          </div>
        </footer>
      </article>
    );
  };

  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <RestaurantBanner slug={slug} crumb="My Orders" title="My Orders" subtitle="Track your current orders and view your order history." image={banner} />
        <div className="rs-tabs">
          {(["all", "ongoing", "completed", "cancelled"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} ({count(t)})</button>)}
        </div>
        {awaiting.map((a) => (
          <Link key={a.id} href={href(slug, `/orders/${a.id}/pay`)} className="rs-await"><b>{a.label}</b><span>{a.note}</span></Link>
        ))}
        {orders.length === 0 ? <p className="rs-empty">You haven&apos;t placed an order yet. <Link href={href(slug, "/catalog")}>Browse the menu</Link></p> : shown.length === 0 ? <p className="rs-empty">No orders here.</p> : (
          <>
            {ongoing.length > 0 && <><h2 className="rs-sec">Ongoing Orders</h2>{ongoing.map((o) => <Card key={o.id} o={o} />)}</>}
            {rest.length > 0 && <><h2 className="rs-sec">Order History</h2>{rest.map((o) => <Card key={o.id} o={o} />)}</>}
          </>
        )}
        <p className="rs-empty" style={{ fontSize: 13 }}>Can&apos;t find an order? <Link href={href(slug, "/account/recover-order")}>Recover it here</Link></p>
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}
