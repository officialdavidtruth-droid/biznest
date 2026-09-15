import Link from "next/link";
import { CalendarDays, Camera, Check, ChevronRight, Edit3, Gift, Heart, Headphones, MapPin, Star, WalletCards } from "lucide-react";

function money(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
function date(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function VelouraAccountProfile({
  slug,
  store,
  user,
  overview,
  bookings,
  savedRooms,
  wallet,
  loyalty,
  heroImage,
}: any) {
  const points = Number(loyalty?.pointsBalance ?? overview?.pointsBalance ?? 0);
  const recent = bookings.slice(0, 3);
  const saved = savedRooms.slice(0, 2);
  const tier = points >= 2000 ? "Platinum" : points >= 1000 ? "Gold" : points >= 500 ? "Silver" : "Member";
  const loyaltyTarget = points >= 2000 ? 3000 : points >= 1000 ? 2000 : points >= 500 ? 1000 : 500;
  const progress = Math.min(100, Math.round((points / loyaltyTarget) * 100));
  const name = user?.name || user?.email || "Guest";
  const location = overview?.defaultAddress ? `${overview.defaultAddress.city}, ${overview.defaultAddress.state}` : null;

  return (
    <div className="veloura-profile-page">
      <section className="veloura-profile-hero" style={heroImage ? { backgroundImage: `linear-gradient(90deg, rgba(21,13,8,.88), rgba(21,13,8,.32)), url(${heroImage})` } : undefined}>
        <div className="veloura-profile-hero-copy"><p>Welcome Back,</p><h1>{name}</h1><span>Manage your bookings, preferences and exclusive member benefits — all in one place.</span></div>
        <div className="veloura-profile-hero-tag">Luxury<br/>Redefined.<br/><em>Moments That Matter.</em></div>
      </section>

      <div className="veloura-profile-stats">
        <div><CalendarDays/><b>{overview?.bookingCount ?? bookings.length}</b><span>Total Bookings</span></div>
        <div><Heart/><b>{overview?.wishlistCount ?? savedRooms.length}</b><span>Saved Rooms</span></div>
        <div><Star/><b>{tier}</b><span>Membership</span></div>
        <div><Gift/><b>{points.toLocaleString()}</b><span>Loyalty Points</span></div>
      </div>

      <div className="veloura-profile-grid">
        <section className="veloura-card">
          <div className="veloura-card-title"><h2>Personal Information</h2><Link href={`/store/${slug}/account/preferences`}><Edit3 size={15}/> Edit</Link></div>
          <div className="veloura-person"><div className="veloura-avatar">{user?.image ? <img src={user.image} alt="" /> : <span>{name.slice(0,1).toUpperCase()}</span>}<button aria-label="Profile photo"><Camera size={14}/></button></div><div><strong>{name}</strong><p>{user?.email || "—"}</p><p>{user?.phone || "Phone number not set"}</p></div></div>
          <dl className="veloura-details"><div><dt>Full Name</dt><dd>{name}</dd></div><div><dt>Email Address</dt><dd>{user?.email || "—"}</dd></div><div><dt>Phone Number</dt><dd>{user?.phone || "Not set"}</dd></div><div><dt>Member Since</dt><dd>{date(user?.createdAt)}</dd></div><div><dt>Location</dt><dd>{location || "Not set"}</dd></div></dl>
        </section>

        <section className="veloura-card">
          <div className="veloura-card-title"><h2>Loyalty & Rewards</h2><Link href={`/store/${slug}/account/loyalty`}>View Details</Link></div>
          <div className="veloura-loyalty-head"><div className="veloura-crown">♛</div><div><strong>{store?.name || "Hotel"} {tier}</strong><p>Enjoy exclusive benefits and special offers.</p></div></div>
          <div className="veloura-progress"><span style={{ width: `${progress}%` }}/></div><div className="veloura-progress-label"><span>{points.toLocaleString()} points</span><span>{Math.max(0, loyaltyTarget - points).toLocaleString()} to next tier</span></div>
          <ul className="veloura-benefits"><li><Check/> Member-only rates</li><li><Check/> Priority booking support</li><li><Check/> Exclusive offers & invitations</li><li><Check/> Special stay benefits</li></ul>
        </section>

        <section className="veloura-card">
          <div className="veloura-card-title"><h2>Preferences</h2><Link href={`/store/${slug}/account`}><Edit3 size={15}/> Edit</Link></div>
          <div className="veloura-pref"><span>Room Type Preference</span><b>Not set</b></div><div className="veloura-pref"><span>Bed Type</span><b>Not set</b></div><div className="veloura-pref"><span>Smoking Preference</span><b>Not set</b></div><div className="veloura-pref"><span>Special Requests</span><b>Not set</b></div><div className="veloura-pref"><span>Communication</span><b>Email & SMS</b></div><div className="veloura-pref"><span>Dietary Preference</span><b>Not set</b></div>
        </section>

        <section className="veloura-card">
          <div className="veloura-card-title"><h2>Recent Bookings</h2><Link href={`/store/${slug}/account/bookings`}>View All</Link></div>
          {recent.length ? recent.map((b:any) => <Link key={b.id} href={`/store/${slug}/account/bookings`} className="veloura-booking-row"><img src={b.service?.images?.[0] || heroImage || ""} alt=""/><div><strong>{b.service?.name || "Hotel Booking"}</strong><span>{b.checkIn && b.checkOut ? `${date(b.checkIn)} → ${date(b.checkOut)}` : date(b.scheduledAt)}</span></div><em>{b.status}</em><ChevronRight size={16}/></Link>) : <div className="veloura-empty">No bookings yet. <Link href={`/store/${slug}/rooms`}>Explore rooms →</Link></div>}
        </section>

        <section className="veloura-card">
          <div className="veloura-card-title"><h2>Saved Rooms</h2><Link href={`/store/${slug}/account/wishlist`}>View All</Link></div>
          <div className="veloura-saved-grid">{saved.map((item:any) => { const room=item.service || item.product; return <Link key={item.id} href={room?.slug ? `/store/${slug}/rooms/${room.slug}` : `/store/${slug}/account/wishlist`}><div className="veloura-saved-image"><img src={room?.images?.[0] || heroImage || ""} alt=""/><span><Heart size={14}/></span></div><strong>{room?.name || "Saved room"}</strong><small>{room?.price ? `From ${money(Number(room.price))} / night` : "View room details"}</small><button>View Details</button></Link>; })}{saved.length===0 && <div className="veloura-empty">No saved rooms yet. <Link href={`/store/${slug}/rooms`}>Browse rooms →</Link></div>}</div>
        </section>

        <section className="veloura-card veloura-help-card">
          {heroImage && <img src={heroImage} alt=""/>}<h2>Need Help?</h2><p>Our team is always ready to assist you.</p><Link href={`/store/${slug}/account/messages`}><Headphones size={16}/> Contact Support</Link></section>
      </div>

      <Link href={`/store/${slug}/account/wallet`} className="veloura-wallet-strip"><WalletCards/><div><strong>Wallet</strong><span>Store balance available for eligible bookings</span></div><b>{wallet ? money(Number(wallet.balance), wallet.currency || "NGN") : money(0)}</b><ChevronRight/></Link>
    </div>
  );
}
