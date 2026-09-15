import Link from "next/link";
import { CalendarDays, Camera, Check, ChevronRight, Edit3, Gift, Heart, Headphones, Star, WalletCards } from "lucide-react";

function money(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
function date(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function VelouraAccountProfile({ slug, store, user, overview, bookings, savedRooms, wallet, loyalty, heroImage }: any) {
  const points = Number(loyalty?.pointsBalance ?? overview?.pointsBalance ?? 0);
  const recent = bookings.slice(0, 3);
  const saved = savedRooms.slice(0, 2);
  const tier = points >= 2000 ? "Platinum" : points >= 1000 ? "Gold" : points >= 500 ? "Silver" : "Member";
  const loyaltyTarget = tier === "Platinum" ? 3000 : tier === "Gold" ? 2000 : tier === "Silver" ? 1000 : 500;
  const progress = Math.min(100, Math.round((points / loyaltyTarget) * 100));
  const name = user?.name || user?.email || "Guest";
  const location = overview?.defaultAddress ? [overview.defaultAddress.city, overview.defaultAddress.state].filter(Boolean).join(", ") : null;

  return (
    <div className="bn-account-page">
      <VelouraAccountProfileHero name={name} heroImage={heroImage} />

      <div className="bn-account-stats">
        <div><CalendarDays /><strong>{overview?.bookingCount ?? bookings.length}</strong><span>Total bookings</span></div>
        <div><Heart /><strong>{overview?.wishlistCount ?? savedRooms.length}</strong><span>Saved rooms</span></div>
        <div><Star /><strong>{tier}</strong><span>Membership</span></div>
        <div><Gift /><strong>{points.toLocaleString()}</strong><span>Loyalty points</span></div>
      </div>

      <div className="bn-account-dashboard-grid">
        <section className="bn-account-card bn-account-personal-card">
          <div className="bn-account-card-heading"><div><span className="bn-account-kicker">PROFILE</span><h2>Personal information</h2></div><Link href={`/store/${slug}/account/preferences`}><Edit3 size={15}/> Edit</Link></div>
          <div className="bn-account-person">
            <div className="bn-account-large-avatar">{user?.image ? <img src={user.image} alt=""/> : <span>{name.slice(0,1).toUpperCase()}</span>}<button aria-label="Profile photo"><Camera size={14}/></button></div>
            <div><strong>{name}</strong><span>{user?.email || "—"}</span><span>{user?.phone || "Phone number not set"}</span></div>
          </div>
          <dl className="bn-account-detail-grid">
            <div><dt>Full name</dt><dd>{name}</dd></div><div><dt>Email</dt><dd>{user?.email || "—"}</dd></div>
            <div><dt>Phone</dt><dd>{user?.phone || "Not set"}</dd></div><div><dt>Member since</dt><dd>{date(user?.createdAt)}</dd></div>
            <div><dt>Location</dt><dd>{location || "Not set"}</dd></div>
          </dl>
        </section>

        <section className="bn-account-card bn-account-loyalty-card">
          <div className="bn-account-card-heading"><div><span className="bn-account-kicker">MEMBERSHIP</span><h2>Loyalty & rewards</h2></div><Link href={`/store/${slug}/account/loyalty`}>View details <ChevronRight size={15}/></Link></div>
          <div className="bn-account-tier"><div className="bn-account-tier-icon">♛</div><div><strong>{store?.name || "Hotel"} {tier}</strong><span>Exclusive benefits and member pricing.</span></div></div>
          <div className="bn-account-progress"><span style={{width:`${progress}%`}}/></div><div className="bn-account-progress-meta"><span>{points.toLocaleString()} points</span><span>{Math.max(0, loyaltyTarget-points).toLocaleString()} to next tier</span></div>
          <ul>{["Member-only rates","Priority booking support","Exclusive offers & invitations","Special stay benefits"].map(item=><li key={item}><Check size={14}/>{item}</li>)}</ul>
        </section>

        <section className="bn-account-card">
          <div className="bn-account-card-heading"><div><span className="bn-account-kicker">YOUR STAY</span><h2>Preferences</h2></div><Link href={`/store/${slug}/account/preferences`}>Edit <ChevronRight size={15}/></Link></div>
          <div className="bn-account-preferences">
            {[["Room type","Not set"],["Bed type","Not set"],["Smoking","Not set"],["Floor / view","Not set"],["Special requests","Not set"],["Communication","Email & SMS"]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </section>

        <section className="bn-account-card">
          <div className="bn-account-card-heading"><div><span className="bn-account-kicker">RESERVATIONS</span><h2>Recent bookings</h2></div><Link href={`/store/${slug}/account/bookings`}>View all <ChevronRight size={15}/></Link></div>
          {recent.length ? <div className="bn-account-bookings-list">{recent.map((b:any)=><Link key={b.id} href={`/store/${slug}/account/bookings/${b.id}`}><img src={b.service?.images?.[0] || heroImage || ""} alt=""/><div><strong>{b.service?.name || "Hotel booking"}</strong><span>{b.checkIn && b.checkOut ? `${date(b.checkIn)} – ${date(b.checkOut)}` : date(b.scheduledAt)}</span></div><em>{String(b.status).toLowerCase()}</em><ChevronRight size={16}/></Link>)}</div> : <div className="bn-account-empty"><CalendarDays/><strong>No bookings yet</strong><span>Your reservations will appear here.</span><Link href={`/store/${slug}/booking`}>Book a stay →</Link></div>}
        </section>

        <section className="bn-account-card">
          <div className="bn-account-card-heading"><div><span className="bn-account-kicker">FAVOURITES</span><h2>Saved rooms</h2></div><Link href={`/store/${slug}/account/wishlist`}>View all <ChevronRight size={15}/></Link></div>
          {saved.length ? <div className="bn-account-saved-grid">{saved.map((item:any)=>{const room=item.service||item.product;return <Link key={item.id} href={room?.slug?`/store/${slug}/rooms/${room.slug}`:`/store/${slug}/account/wishlist`}><div><img src={room?.images?.[0]||heroImage||""} alt=""/><span><Heart size={14}/></span></div><strong>{room?.name||"Saved room"}</strong><small>{room?.price?`From ${money(Number(room.price),room.currency||"NGN")} / night`:"View room details"}</small></Link>})}</div> : <div className="bn-account-empty"><Heart/><strong>No saved rooms</strong><span>Save a room and it will appear here.</span><Link href={`/store/${slug}/rooms`}>Explore rooms →</Link></div>}
        </section>

        <Link href={`/store/${slug}/account/wallet`} className="bn-account-wallet-card"><div className="bn-account-wallet-icon"><WalletCards/></div><div><span>WALLET</span><strong>{wallet ? money(Number(wallet.balance), wallet.currency || "NGN") : money(0)}</strong><small>Available balance</small></div><ChevronRight/></Link>
        <Link href={`/store/${slug}/account/messages`} className="bn-account-help-card"><div><span>CONCIERGE</span><h2>Need a hand?</h2><p>Message the hotel team about your stay, requests or questions.</p><strong>Contact the team <ChevronRight size={15}/></strong></div><Headphones/></Link>
      </div>
    </div>
  );
}

function VelouraAccountProfileHero({name,heroImage}:{name:string;heroImage?:string|null}){
  return <section className="bn-account-profile-hero" style={heroImage?{backgroundImage:`linear-gradient(105deg,rgba(3,25,19,.96),rgba(3,25,19,.65) 55%,rgba(3,25,19,.24)),url(${heroImage})`}:undefined}>
    <div><span>WELCOME BACK</span><h1>{name}</h1><p>Your reservations, preferences and member benefits — all in one place.</p></div>
    <div className="bn-account-profile-tag">Your stay.<br/><em>Your way.</em></div>
  </section>
}
