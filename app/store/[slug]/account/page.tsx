import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Heart, Star, Gift, Pencil, ArrowRight, Headphones } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerOverview, listStoreBookings, listStoreWishlist } from "@/lib/actions/account";
import { getStoreLoyaltySummary } from "@/lib/actions/loyalty";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";

const money = (value: unknown, currency = "NGN") => `${currency === "NGN" ? "₦" : currency + " "}${Number(value || 0).toLocaleString()}`;
const date = (v: Date | string) => new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

export default async function StoreAccountOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, session, overview, bookings, wishlist, loyalty, hotel] = await Promise.all([
    getStoreBranding(slug), getStoreCustomerSessionForStore(slug), getStoreCustomerOverview(slug), listStoreBookings(slug), listStoreWishlist(slug), getStoreLoyaltySummary(slug), getHotelContent(slug),
  ]);
  if (!store || !session?.user || !overview) notFound();
  const user = session.user;
  const hero = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || store.bannerUrl;
  const upcoming = bookings.filter((b: any) => b.status !== "CANCELLED" && new Date(b.checkOut ?? b.scheduledAt) >= new Date()).slice(0, 3);
  const savedRooms = wishlist.filter((x: any) => x.service).slice(0, 2);
  const points = loyalty?.pointsBalance ?? overview.pointsBalance;
  const tier = points >= 2000 ? "Platinum" : points >= 1000 ? "Gold" : points >= 500 ? "Silver" : "Member";
  const next = points >= 2000 ? points : 2000;
  const defaultAddress = overview.defaultAddress;
  const location = [defaultAddress?.city, defaultAddress?.state, defaultAddress?.country].filter(Boolean).join(", ");

  return <div className="veloura-account-content">
    <VelouraAccountHero title={`Welcome Back, ${user.name || user.email}`} subtitle="Manage your bookings, preferences and exclusive member benefits — all in one place." image={hero} />
    <div className="veloura-stat-grid">
      <div className="veloura-stat"><div className="veloura-stat-icon"><CalendarDays /></div><div><h3>{overview.bookingCount}</h3><p>Total Bookings</p></div></div>
      <div className="veloura-stat"><div className="veloura-stat-icon"><Heart /></div><div><h3>{overview.wishlistCount}</h3><p>Saved Rooms</p></div></div>
      <div className="veloura-stat"><div className="veloura-stat-icon"><Star /></div><div><h3>{tier}</h3><p>Membership Tier</p></div></div>
      <div className="veloura-stat"><div className="veloura-stat-icon"><Gift /></div><div><h3>{points.toLocaleString()}</h3><p>Loyalty Points</p></div></div>
    </div>

    <div className="veloura-panel-grid">
      <section className="veloura-panel"><div className="veloura-panel-head"><h2>Personal Information</h2><Link href={`/store/${slug}/account/addresses`}><Pencil size={14}/> Edit</Link></div><dl className="veloura-detail-list"><div><dt>Full Name</dt><dd>{user.name || "Not set"}</dd></div><div><dt>Email Address</dt><dd>{user.email}</dd></div><div><dt>Phone Number</dt><dd>{(user as any).phone || "Not set"}</dd></div><div><dt>Member Since</dt><dd>{date((user as any).createdAt || new Date())}</dd></div><div><dt>Location</dt><dd>{location || "Not set"}</dd></div></dl></section>
      <section className="veloura-panel"><div className="veloura-panel-head"><h2>Loyalty & Rewards</h2><Link href={`/store/${slug}/account/loyalty`}>View Details</Link></div><div style={{display:"flex",gap:15,alignItems:"center"}}><div className="veloura-crown">♛</div><div style={{flex:1}}><h3 style={{margin:0}}>{tier} Member</h3><p style={{fontSize:11,color:"#68736f"}}>Earn and redeem rewards from {store.name}.</p><div className="veloura-progress"><span style={{width:`${Math.min(100, (points/next)*100)}%`}}/></div><p style={{fontSize:11}}>{points.toLocaleString()} / {next.toLocaleString()} points</p></div></div><ul style={{paddingLeft:18,fontSize:11,lineHeight:1.9}}><li>Member rewards and offers</li><li>Booking-related points</li><li>Store-specific reward balance</li></ul></section>
      <section className="veloura-panel"><div className="veloura-panel-head"><h2>Preferences</h2><Link href={`/store/${slug}/account/preferences`}><Pencil size={14}/> Edit</Link></div><dl className="veloura-detail-list"><div><dt>Room Type</dt><dd>{"Not set"}</dd></div><div><dt>Bed Type</dt><dd>{"Not set"}</dd></div><div><dt>Smoking</dt><dd>{"Not set"}</dd></div><div><dt>Special Requests</dt><dd>{"Not set"}</dd></div><div><dt>Communication</dt><dd>{"Not set"}</dd></div></dl></section>
    </div>

    <div className="veloura-panel-grid" style={{marginTop:12}}>
      <section className="veloura-panel"><div className="veloura-panel-head"><h2>Recent Bookings</h2><Link href={`/store/${slug}/account/bookings`}>View All</Link></div>{upcoming.length ? upcoming.map((b:any)=><Link key={b.id} href={`/store/${slug}/account/bookings`} className="veloura-booking-row" style={{textDecoration:"none",color:"inherit"}}><img src={b.service.images?.[0] || hero || ""} alt=""/><div><strong>{b.service.name}</strong><small>{b.checkIn && b.checkOut ? `${date(b.checkIn)} – ${date(b.checkOut)}` : date(b.scheduledAt)}</small></div><span className="veloura-badge">{b.status}</span><ArrowRight size={15}/></Link>) : <div className="veloura-empty">No bookings yet.</div>}</section>
      <section className="veloura-panel"><div className="veloura-panel-head"><h2>Saved Rooms</h2><Link href={`/store/${slug}/account/wishlist`}>View All</Link></div>{savedRooms.length ? <div className="veloura-room-grid">{savedRooms.map((x:any)=>{const r=x.service; return <div className="veloura-room-card" key={x.id}><img src={r.images?.[0] || hero || ""} alt=""/><div><h3>{r.name}</h3><p>From <strong>{money(r.price,r.currency)}</strong> / night</p><div className="veloura-room-actions"><Link href={`/store/${slug}/rooms/${r.slug}`}>View Details</Link><Link href={`/store/${slug}/booking`}>Book Now</Link></div></div></div>})}</div> : <div className="veloura-empty">No saved rooms yet.</div>}</section>
      <section className="veloura-panel"><img src={hero || ""} alt="" style={{width:"100%",height:125,objectFit:"cover",borderRadius:5}}/><h2 style={{marginTop:12,marginBottom:4}}>Need Help?</h2><p style={{fontSize:12,color:"#68736f"}}>Our team is available to assist you.</p><Link className="veloura-gold-btn" href={`/store/${slug}/account/support`}><Headphones size={15} style={{verticalAlign:"middle",marginRight:6}}/>Contact Support</Link></section>
    </div>
  </div>;
}
