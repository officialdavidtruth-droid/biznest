"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Lock, ShieldCheck, Truck, CreditCard, CalendarDays, MapPin, Minus, Plus, Tag, ChevronDown } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { submitCheckout } from "@/lib/checkout/client";
import { listActiveDeliveryZones } from "@/lib/actions/delivery-zone";
import { DeliveryZoneOptions } from "@/components/checkout/delivery-zone-options";
import { toast } from "sonner";

type Zone = { id: string; name: string; city: string | null; fee: number; estimatedMinutes: number | null };

type Form = { fullName: string; email: string; phone: string; address: string; apartment: string; city: string; state: string; zip: string; country: string };

export function RestaurantCheckoutClient({ slug }: { slug: string }) {
  const { items, storeSlug, subtotal } = useCart();
  const cart = storeSlug === slug ? items : [];
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [delivery, setDelivery] = useState<"delivery" | "takeaway" | "schedule">("delivery");
  const [payment, setPayment] = useState("card");
  const [promo, setPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<Form>({fullName:"",email:"",phone:"",address:"",apartment:"",city:"",state:"",zip:"",country:"Nigeria"});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const currency = cart[0]?.currency || "NGN";
  useEffect(() => { listActiveDeliveryZones(slug).then(z => { const next=z.map(x=>({id:x.id,name:x.name,city:x.city,fee:Number(x.fee),estimatedMinutes:x.estimatedMinutes})); setZones(next); if(next[0]) setZoneId(next[0].id); }).catch(()=>setZones([])); }, [slug]);
  const zone = zones.find(z => z.id === zoneId);
  const deliveryFee = delivery === "delivery" ? (zone?.fee ?? 3990 / 100) : 0;
  const tax = subtotal * .07;
  const total = subtotal + deliveryFee + tax;
  const styles = useMemo(() => ({"--rr-green":"#064936","--rr-green-dark":"#003C2E","--rr-cream":"#F8F7F4"} as React.CSSProperties), []);

  const set = (key: keyof Form, value: string) => setForm(prev => ({...prev,[key]:value}));
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) return;
    setIsSubmitting(true);
    try {
      const result = await submitCheckout({ slug, items: cart, deliveryZoneId: delivery === "delivery" ? zoneId || undefined : undefined, shippingAddress: { fullName: form.fullName, phone: form.phone, address: form.address + (form.apartment ? `, ${form.apartment}` : ""), city: form.city, state: form.state, country: form.country }, idempotencyKey });
      if (!result.success) { toast.error(result.error); return; }
      window.location.assign(result.data.authorizationUrl);
    } catch { toast.error("We couldn't start payment. Please try again."); }
    finally { setIsSubmitting(false); }
  }

  if (!cart.length) return <main className="rr-checkout-empty"><h1>Your order is empty.</h1><Link href={`/store/${slug}/catalog`}>Back to Menu</Link></main>;
  return <main className="rr-checkout" style={styles}>
    <div className="rr-checkout-inner">
      <header className="rr-checkout-title"><h1>Checkout</h1><p>Please review your order and complete your purchase</p><div className="rr-checkout-steps"><span className="active"><b>1</b>Cart</span><i></i><span className="active"><b>2</b>Checkout</span><i></i><span><b>3</b>Confirmation</span></div></header>
      <form onSubmit={handleSubmit} className="rr-checkout-grid">
        <div className="rr-checkout-left">
          <section className="rr-form-section"><h2>Delivery Information</h2><div className="rr-fields"><label><b>Full Name *</b><input required value={form.fullName} onChange={e=>set("fullName",e.target.value)} placeholder="Enter your full name"/></label><label><b>Phone Number *</b><div className="rr-phone"><span>🇺🇸　+1</span><input required value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="Enter your phone number"/></div></label><label className="wide"><b>Email Address *</b><input required type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="Enter your email address"/></label><label><b>Delivery Address *</b><input required value={form.address} onChange={e=>set("address",e.target.value)} placeholder="House number, street name"/></label><label><b>Apartment, Suite, etc. (Optional)</b><input value={form.apartment} onChange={e=>set("apartment",e.target.value)} placeholder="Apartment, suite, unit, etc."/></label><label><b>City *</b><input required value={form.city} onChange={e=>set("city",e.target.value)} placeholder="Enter your city"/></label><label><b>State *</b><select required value={form.state} onChange={e=>set("state",e.target.value)}><option value="">Select state</option><option>Lagos</option><option>Abuja</option><option>Rivers</option><option>Oyo</option><option>Enugu</option></select></label><label><b>ZIP Code *</b><input required value={form.zip} onChange={e=>set("zip",e.target.value)} placeholder="Enter ZIP code"/></label></div><label className="rr-save"><input type="checkbox"/> Save this address for faster checkout next time</label></section>
          <section className="rr-form-section"><h2>Delivery Options</h2><div className="rr-delivery-options"><button type="button" className={delivery === "delivery" ? "selected" : ""} onClick={()=>setDelivery("delivery")}><Truck/><span><b>Delivery</b><small>{zone?.estimatedMinutes ? `${zone.estimatedMinutes} mins` : "30 - 45 mins"}</small><strong>{currency} {deliveryFee.toFixed(2)}</strong></span><i></i></button><button type="button" className={delivery === "takeaway" ? "selected" : ""} onClick={()=>setDelivery("takeaway")}><MapPin/><span><b>Takeaway</b><small>20 - 30 mins</small><strong>Free</strong></span><i></i></button><button type="button" className={delivery === "schedule" ? "selected" : ""} onClick={()=>setDelivery("schedule")}><CalendarDays/><span><b>Schedule Order</b><small>Choose date & time</small><strong>Free</strong></span><i></i></button></div>{zones.length>1 && delivery === "delivery" && <select className="rr-zone-select" value={zoneId} onChange={e=>setZoneId(e.target.value)}><option value="">Select delivery area</option><DeliveryZoneOptions zones={zones}/></select>}</section>
          <section className="rr-form-section"><h2>Payment Method</h2><div className="rr-payment-list">{[["card","▣","Credit / Debit Card","VISA　 🟠　AMEX"],["paypal","ℙ","PayPal","PayPal"],["apple","▣","Apple Pay","Pay"],["cash","▣","Cash on Delivery",""]].map(([id,icon,label,brand])=><button type="button" key={id} className={payment===id?"selected":""} onClick={()=>setPayment(id)}><i>{payment===id?"●":"○"}</i><span>{icon}</span><b>{label}</b><strong>{brand}</strong></button>)}</div><p className="rr-payment-secure"><Lock size={12}/> Your payment information is secured and encrypted</p></section>
        </div>
        <aside className="rr-summary"><div className="rr-summary-head"><div><p>Your Order ({cart.length})</p><button type="button" onClick={()=>window.location.assign(`/store/${slug}/cart`)}>Edit Cart</button></div></div>{cart.map(item=><div className="rr-summary-item" key={item.productId}><div className="rr-summary-img" style={item.image?{backgroundImage:`url(${item.image})`}:{}}/><div><b>{item.name}</b><span>{currency} {item.price.toFixed(2)}</span><div className="rr-mini-qty"><Minus size={12}/><span>{item.quantity}</span><Plus size={12}/></div></div><button type="button">×</button><strong>{currency} {(item.price*item.quantity).toFixed(2)}</strong></div>)}<div className="rr-summary-totals"><div><span>Subtotal</span><b>{currency} {subtotal.toFixed(2)}</b></div><div><span>Delivery Fee</span><b>{currency} {deliveryFee.toFixed(2)}</b></div><div><span>Tax (7%)</span><b>{currency} {tax.toFixed(2)}</b></div><hr/><div className="grand"><span>Total</span><b>{currency} {total.toFixed(2)}</b></div></div><button type="button" className="rr-promo" onClick={()=>setPromo(v=>!v)}><Tag size={16}/> Have a promo code?<ChevronDown size={16}/></button>{promo && <input className="rr-promo-input" placeholder="Enter promo code"/>}<button disabled={isSubmitting} className="rr-place-order" type="submit">{isSubmitting ? "Preparing Payment..." : <>Place Order　🔒</>}</button><div className="rr-secure"><ShieldCheck size={15}/><b>Secure Checkout</b><span>100% secure and encrypted payment</span></div></aside>
      </form>
    </div>
  </main>;
}
