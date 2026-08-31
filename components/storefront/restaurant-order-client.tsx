"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, Bookmark, Minus, Plus, Search, SlidersHorizontal, Truck, Flame, ShieldCheck, Headphones } from "lucide-react";
import { useCart } from "@/lib/cart-context";

type Item = { id: string; kind: "product" | "service"; name: string; description: string | null; price: number; currency: string; image: string | null; categoryName: string | null; isBookable: boolean };

const imageStyle = (url: string | null) => url ? { backgroundImage: `url(${url})` } : {};

export function RestaurantOrderClient({ slug, items, heroImage }: { slug: string; items: Item[]; heroImage?: string | null }) {
  const { items: cartItems, storeSlug, addItem, setQuantity, removeItem, subtotal } = useCart();
  const cart = storeSlug === slug ? cartItems : [];
  const [category, setCategory] = useState("Chef's Specials");
  const [search, setSearch] = useState("");
  const currency = cart[0]?.currency || items[0]?.currency || "NGN";
  const filtered = useMemo(() => items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const visible = filtered.slice(0, 5);
  const categories = ["Chef's Specials", "Salads", "Pizza", "Burgers", "Pasta", "Main Course", "Beverages", "Desserts", "Soups", "Appetizers"];
  const total = subtotal + 3990 / 100;

  return <>
    <section className="rr-order-hero" style={heroImage ? {"--rr-order-image": `url(${heroImage})`} as CSSProperties : undefined}>
      <div className="rr-order-hero-copy">
        <em>Delicious Food, Delivered Fresh</em>
        <h1>Order Your<br/>Favorite Meals</h1>
        <p>Fresh ingredients, masterful cooking and fast delivery at your doorstep.</p>
        <div className="rr-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for dishes..."/><button type="button"><SlidersHorizontal size={16}/> Filter</button></div>
        <div className="rr-perks"><span><Truck/><b>30 - 45 Mins Delivery<small>Fast & reliable</small></b></span><span><Flame/><b>Fresh & Quality Food<small>Cooked to perfection</small></b></span><span><ShieldCheck/><b>Secure Payment<small>100% safe checkout</small></b></span><span><Headphones/><b>Live Order Tracking<small>Track your order</small></b></span></div>
      </div>
    </section>

    <section className="rr-order-layout">
      <aside className="rr-categories">
        <h3>Categories</h3>
        {categories.map((c, i) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}><span>{["♨","🥗","🍕","🍔","🍝","🍗","🥤","🍰","🍲","🥖"][i]}</span>{c}</button>)}
        <div className="rr-offer"><em>Special Offer</em><h3>Get 20% Off<br/>On All Orders<br/>Above $50</h3><button>Order Now</button></div>
      </aside>

      <main className="rr-specials">
        <div className="rr-section-title"><div><h2>{category}</h2></div><span>{Math.max(filtered.length, 8)} Items</span></div>
        {visible.map(item => {
          const inCart = cart.find(c => c.productId === item.id);
          return <article className="rr-food-row" key={item.id}>
            <Link href={`/store/${slug}/${item.kind}/${item.id}`} className="rr-food-image" style={imageStyle(item.image)}/>
            <div className="rr-food-copy"><h3>{item.name}</h3><p>{item.description || "Freshly prepared with quality ingredients and seasonal vegetables."}</p><strong>{item.currency} {item.price.toLocaleString()}</strong></div>
            <Bookmark className="rr-bookmark" size={18}/>
            <div className="rr-food-actions">{inCart ? <div className="rr-qty"><button onClick={() => setQuantity(item.id, inCart.quantity - 1)}><Minus size={14}/></button><span>{inCart.quantity}</span><button onClick={() => setQuantity(item.id, inCart.quantity + 1)}><Plus size={14}/></button></div> : <div className="rr-qty"><button onClick={() => setQuantity(item.id, 0)}><Minus size={14}/></button><span>1</span><button onClick={() => setQuantity(item.id, 2)}><Plus size={14}/></button></div>}<button className="rr-add" onClick={() => addItem(slug, { productId: item.id, name: item.name, price: item.price, currency: item.currency, image: item.image })}>Add</button></div>
          </article>;
        })}
        <Link className="rr-view-all" href={`/store/${slug}/catalog`}>▦　 View All Menu</Link>
      </main>

      <aside className="rr-order-cart">
        <div className="rr-cart-head"><h3>Your Order ({cart.length})</h3><button onClick={() => cart.forEach(i => removeItem(i.productId))}>Clear All</button></div>
        {cart.length === 0 ? <div className="rr-cart-empty">Your order is empty.<br/><span>Add a dish to get started.</span></div> : cart.map(item => <div className="rr-cart-item" key={item.productId}><div className="rr-cart-image" style={imageStyle(item.image)}/><div className="rr-cart-info"><b>{item.name}</b><span>{item.currency} {item.price.toLocaleString()}</span><div className="rr-cart-qty"><button onClick={() => setQuantity(item.productId, item.quantity - 1)}><Minus size={12}/></button><span>{item.quantity}</span><button onClick={() => setQuantity(item.productId, item.quantity + 1)}><Plus size={12}/></button></div></div><button className="rr-remove" onClick={() => removeItem(item.productId)}>×</button></div>)}
        <div className="rr-cart-totals"><div><span>Subtotal</span><b>{currency} {subtotal.toLocaleString()}</b></div><div><span>Delivery Fee</span><b>{currency} 3.99</b></div><div><span>Tax (7%)</span><b>{currency} {(subtotal * .07).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div><hr/><div className="grand"><span>Total</span><b>{currency} {(total + subtotal * .07).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div></div>
        <Link className="rr-checkout-btn" href={`/store/${slug}/checkout`}>Proceed to Checkout <ArrowRight size={18}/></Link>
        <Link className="rr-continue" href={`/store/${slug}/catalog`}>←　 Continue Shopping</Link>
        <div className="rr-delivery-card"><Truck/><div><b>Estimated Delivery</b><strong>30 - 45 mins</strong><span>Your order will be delivered hot and fresh.</span></div></div>
      </aside>
    </section>
  </>;
}
