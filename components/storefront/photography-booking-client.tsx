"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createBooking, getAvailableSlots } from "@/lib/actions/booking";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString()}`;
}

export function PhotographyBookingClient({
  store,
  slug,
  service,
  theme,
}: {
  store: any;
  slug: string;
  service: any;
  theme: any;
}) {
  const accent = theme.accent || "#B28A2E";
  const ink = "#171717";
  const goldSoft = "#F5EFE2";
  const currency = service.currency || "NGN";
  const basePrice = Number(service.price || 0);
  const images: string[] = Array.isArray(service.images) ? service.images.filter(Boolean) : [];
  const { isSignedIn } = useShopAuthGate(slug);
  const [busy, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [sessionType, setSessionType] = useState("Portrait Session");
  const [packageName, setPackageName] = useState("Standard");
  const [location, setLocation] = useState("Studio");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [paymentStarted, setPaymentStarted] = useState(false);

  const packages = useMemo(() => [
    { name: "Basic", price: Math.round(basePrice * 0.6), lines: ["1 Hour Session", "1 Location", "20 Edited Photos", "Online Gallery"] },
    { name: "Standard", price: basePrice, popular: true, lines: ["2 Hour Session", "2 Locations", "40 Edited Photos", "Online Gallery", "Print Release"] },
    { name: "Premium", price: Math.round(basePrice * 1.6), lines: ["3 Hour Session", "3 Locations", "60 Edited Photos", "Online Gallery", "Print Release", "Photo Album"] },
  ], [basePrice]);

  useEffect(() => {
    let alive = true;
    setLoadingSlots(true);
    setTime("");
    getAvailableSlots(service.id, date).then((result) => {
      if (!alive) return;
      setSlots(result);
      setLoadingSlots(false);
    }).catch(() => {
      if (!alive) return;
      setSlots([]);
      setLoadingSlots(false);
    });
    return () => { alive = false; };
  }, [date, service.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return toast.error("Choose your preferred date and time.");
    if (!isSignedIn && (!name.trim() || !email.trim() || !phone.trim())) {
      return toast.error("Enter your name, email and phone number to continue.");
    }

    const selectedPackage = packages.find((p) => p.name === packageName);
    const note = [
      `Session type: ${sessionType}`,
      `Package: ${packageName}${selectedPackage ? ` (${money(currency, selectedPackage.price)})` : ""}`,
      `Location preference: ${location}`,
      requests.trim() ? `Special requests: ${requests.trim()}` : "",
    ].filter(Boolean).join("\n");

    startTransition(async () => {
      const guest = isSignedIn ? undefined : { name: name.trim(), email: email.trim(), phone: phone.trim() };
      const result = await createBooking(slug, service.id, date, time, note, guest);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (basePrice <= 0) {
        setConfirmed(true);
        return;
      }
      setPaymentStarted(true);
      const payment = await startBookingPayment(slug, result.data.bookingId, isSignedIn ? undefined : email.trim());
      if (!payment.success) {
        setPaymentStarted(false);
        setConfirmed(true);
        toast.error(payment.error || "Booking created, but payment could not be opened.");
        return;
      }
      window.location.assign(payment.data.authorizationUrl);
    });
  }

  const hero = images[0];
  const thumbs = images.length ? images.slice(1, 4) : [];

  return (
    <div style={{ background: "#fff", color: ink, minHeight: "100vh", fontFamily: theme.font || "Arial, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .photo-book-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.95fr);gap:36px;align-items:start}
        .photo-gallery{display:grid;grid-template-columns:minmax(0,2fr) minmax(120px,.78fr);gap:10px;height:455px}
        .photo-thumb-col{display:grid;grid-template-rows:repeat(3,1fr);gap:10px}
        .photo-packages{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .photo-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .photo-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .photo-field{width:100%;box-sizing:border-box;border:1px solid #d8d4cc;border-radius:5px;padding:13px 12px;background:#fff;color:#222;font-size:13px;outline:none}
        .photo-label{display:block;font-size:11px;font-weight:800;margin:0 0 7px;letter-spacing:.02em}
        .photo-package{border:1px solid #ddd8cf;border-radius:7px;padding:18px;background:#fff;position:relative}
        .photo-package.selected{border:2px solid ${accent};padding:17px;background:${goldSoft}}
        @media(max-width:850px){.photo-book-grid{grid-template-columns:1fr}.photo-gallery{height:360px}.photo-packages{grid-template-columns:1fr}.photo-trust{grid-template-columns:1fr}.photo-form-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.photo-gallery{grid-template-columns:1fr;height:auto}.photo-thumb-col{display:none}}
      `}} />

      <div style={{ background: "#080808", color: "#fff", fontSize: 11, padding: "9px 5vw", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>⌖ {store.address || "2464 Royal Ln. Mesa, New Jersey 45463"} &nbsp;&nbsp; ☎ {store.phone || "(000) 123-0000"} &nbsp;&nbsp; ✉ {store.email || "hello@verestudio.com"}</div>
        <div>Follow Us: &nbsp; ● &nbsp; ◎ &nbsp; ◉ &nbsp; ♪ &nbsp; ▶</div>
      </div>
      <header style={{ borderBottom: "1px solid #eee", background: "#fff" }}>
        <div style={{ maxWidth: 1180, margin: "auto", padding: "15px 5vw", display: "flex", alignItems: "center", gap: 28 }}>
          <Link href={`/${slug}`} style={{ display: "flex", alignItems: "center", gap: 11, color: ink, textDecoration: "none", minWidth: 190 }}>
            <span style={{ width: 38, height: 38, border: `1px solid ${accent}`, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 20 }}>▣</span>
            <span><strong style={{ display: "block", fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 20, letterSpacing: ".08em" }}>{store.name || "VERE STUDIO"}</strong><small style={{ letterSpacing: ".25em", fontSize: 8 }}>PHOTOGRAPHY</small></span>
          </Link>
          <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 30, fontSize: 12, fontWeight: 700 }}>
            <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
            <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>About Us</Link>
            <Link href={`/${slug}/catalog`} style={{ color: ink, textDecoration: "none", borderBottom: `2px solid ${accent}`, paddingBottom: 7 }}>Services</Link>
            <Link href={`/${slug}/catalog`} style={{ color: ink, textDecoration: "none" }}>Portfolio</Link>
            <Link href={`/${slug}/catalog`} style={{ color: ink, textDecoration: "none" }}>Packages</Link>
            <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Blog</Link>
            <Link href={`/${slug}/start-project`} style={{ color: ink, textDecoration: "none" }}>Contact Us</Link>
            <a href="#book" style={{ background: "#080808", color: "#fff", padding: "13px 19px", borderRadius: 24, textDecoration: "none" }}>▣ &nbsp; Book Now</a>
          </nav>
        </div>
      </header>

      <section style={{ minHeight: 255, background: hero ? `linear-gradient(90deg,rgba(0,0,0,.82),rgba(0,0,0,.22)),url(${hero}) center/cover` : "linear-gradient(90deg,#111,#333)", color: "#fff", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1180, width: "100%", margin: "auto", padding: "55px 5vw" }}>
          <div style={{ color: accent, fontSize: 11, letterSpacing: ".18em", fontWeight: 800 }}>PROFESSIONAL PHOTOGRAPHY</div>
          <h1 style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: "clamp(44px,6vw,64px)", lineHeight: .95, margin: "12px 0 13px", maxWidth: 500 }}>Book Your<br/>Photoshoot</h1>
          <p style={{ maxWidth: 390, lineHeight: 1.6, fontSize: 13, margin: 0 }}>Capture your best moments with our professional photography services.</p>
          <div style={{ marginTop: 16, fontSize: 12 }}>Home &nbsp; / &nbsp; Services &nbsp; / &nbsp; {service.name}</div>
        </div>
      </section>

      <main style={{ maxWidth: 1180, margin: "auto", padding: "25px 5vw 70px" }}>
        <div className="photo-book-grid">
          <section>
            <h2 style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 28, margin: "0 0 7px", borderBottom: `3px solid ${accent}`, width: "fit-content", paddingBottom: 6 }}>{service.name}</h2>
            <div style={{ fontSize: 12, marginBottom: 12 }}>★ <b>{service.reviews?.length ? "4.9" : "4.9"}</b> <span style={{ opacity: .65 }}>({service.reviews?.length || 128} Reviews)</span></div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: "#555", maxWidth: 650, marginTop: 0 }}>{service.description || "Perfect for individual, couples, or family portraits. Indoor or outdoor sessions available with professional lighting and editing."}</p>

            <div className="photo-trust" style={{ margin: "18px 0" }}>
              {[['◷','Session Duration',service.durationMins ? `${Math.max(1, Math.round(service.durationMins / 60))} Hours` : '1 - 2 Hours'],['▧','High Resolution','Edited Photos'],['♧','Delivery Time','3 - 5 Days']].map(([icon,title,text])=><div key={title} style={{ background: "#faf9f7", padding: 12, display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 21 }}>{icon}</span><span><b style={{ display: "block", fontSize: 11 }}>{title}</b><small style={{ fontSize: 10, color: "#666" }}>{text}</small></span></div>)}
            </div>

            <div className="photo-gallery">
              <div style={{ borderRadius: 6, overflow: "hidden", background: "#eee" }}>{hero ? <img src={hero} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 50 }}>▣</div>}</div>
              <div className="photo-thumb-col">{thumbs.map((src,i)=><div key={src+i} style={{ borderRadius: 6, overflow: "hidden", background: "#eee" }}><img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}{Array.from({length: Math.max(0,3-thumbs.length)}).map((_,i)=><div key={`empty${i}`} style={{ borderRadius: 6, background: "linear-gradient(135deg,#ddd,#aaa)" }} />)}</div>
            </div>

            <h3 style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 17, margin: "15px 0 9px" }}>Packages & Pricing</h3>
            <div className="photo-packages">
              {packages.map((p)=><button type="button" key={p.name} className={`photo-package ${packageName===p.name?"selected":""}`} onClick={()=>setPackageName(p.name)} style={{ textAlign: "left", cursor: "pointer", color: ink }}>
                {p.popular && <span style={{ position: "absolute", right: 10, top: -9, background: accent, color: "#fff", padding: "3px 8px", borderRadius: 3, fontSize: 8, fontWeight: 800 }}>POPULAR</span>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 16 }}>{p.name}</span><b style={{ fontSize: 15 }}>{money(currency,p.price)}</b></div>
                <ul style={{ paddingLeft: 16, minHeight: 105, margin: "13px 0", fontSize: 10.5, lineHeight: 1.9 }}>{p.lines.map(x=><li key={x}>✓ {x}</li>)}</ul>
                <span style={{ display: "block", textAlign: "center", border: `1px solid ${p.name===packageName?accent:'#aaa'}`, background: p.name===packageName?accent:'#fff', color:p.name===packageName?'#fff':ink, borderRadius: 4, padding: 9, fontSize: 10, fontWeight: 800 }}>{p.name===packageName?'Selected':'Select Package'}</span>
              </button>)}
            </div>

            <h3 style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 17, margin: "16px 0 10px" }}>What's Included</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, fontSize: 10 }}>{['Professional Equipment','Expert Photography','Photo Editing','Online Gallery','Print Release'].map(x=><div key={x} style={{ padding: 8, background:'#faf9f7' }}>▣<br/><b>{x}</b></div>)}</div>
          </section>

          <aside id="book" style={{ border: "1px solid #ddd8cf", borderRadius: 8, padding: 20, background: "#fff", boxShadow: "0 8px 28px rgba(0,0,0,.04)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 23 }}>▣</span><h2 style={{ fontFamily: theme.headlineFont || "Georgia, serif", margin: 0, fontSize: 21 }}>Book Your Session</h2></div>
            <p style={{ fontSize: 11, color: "#777", margin: "0 0 17px" }}>Fill in the details below to book your photoshoot</p>
            {confirmed ? <div style={{ padding: 20, background: goldSoft, borderRadius: 7 }}><b style={{ fontFamily: theme.headlineFont || "Georgia, serif", fontSize: 20 }}>Booking received</b><p style={{ fontSize: 12, lineHeight: 1.6 }}>Your session request has been created. We&apos;ll send confirmation and payment details to your email.</p></div> : <form onSubmit={submit}>
              {!isSignedIn && <>
                <label className="photo-label">Full Name *</label><input className="photo-field" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" required />
                <label className="photo-label" style={{marginTop:12}}>Email Address *</label><input className="photo-field" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address" required />
                <label className="photo-label" style={{marginTop:12}}>Phone Number *</label><input className="photo-field" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter your phone number" required />
              </>}
              <label className="photo-label" style={{marginTop:12}}>Session Type *</label><select className="photo-field" value={sessionType} onChange={e=>setSessionType(e.target.value)}><option>Portrait Session</option><option>Wedding Photography</option><option>Family Photography</option><option>Commercial Photography</option><option>Product Photography</option><option>Event Photography</option></select>
              <label className="photo-label" style={{marginTop:12}}>Package *</label><select className="photo-field" value={packageName} onChange={e=>setPackageName(e.target.value)}>{packages.map(p=><option key={p.name}>{p.name}</option>)}</select>
              <div className="photo-form-grid" style={{marginTop:12}}><div><label className="photo-label">Preferred Date *</label><input className="photo-field" type="date" min={todayISO()} value={date} onChange={e=>setDate(e.target.value)} required /></div><div><label className="photo-label">Preferred Time *</label><select className="photo-field" value={time} onChange={e=>setTime(e.target.value)} required><option value="">{loadingSlots?'Checking…':'Select time'}</option>{slots.map(s=><option key={s}>{s}</option>)}</select></div></div>
              <label className="photo-label" style={{marginTop:12}}>Location Preference *</label><div style={{display:'flex',gap:15,fontSize:11}}>{['Studio','Outdoor','Both'].map(x=><label key={x}><input type="radio" checked={location===x} onChange={()=>setLocation(x)} /> {x}</label>)}</div>
              <label className="photo-label" style={{marginTop:14}}>Special Requests (Optional)</label><textarea className="photo-field" rows={3} value={requests} onChange={e=>setRequests(e.target.value)} placeholder="Any special requests or details we should know?" />
              <button disabled={busy} type="submit" style={{width:'100%',marginTop:12,border:0,borderRadius:4,padding:'14px',background:'#080808',color:'#fff',fontWeight:800,cursor:busy?'wait':'pointer'}}>{paymentStarted?'Opening payment…':busy?'Booking…':'Book Now  ▣'}</button>
              <p style={{fontSize:10,textAlign:'center',color:'#777',lineHeight:1.5}}>You&apos;ll receive a confirmation email with all the details once your booking is confirmed.</p>
            </form>}
          </aside>
        </div>

        <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginTop:22}}>
          <div style={{background:'#faf9f7',padding:20}}><h3 style={{fontFamily:theme.headlineFont||'Georgia, serif',fontSize:15,marginTop:0}}>Important Information</h3><ul style={{fontSize:10.5,lineHeight:2,paddingLeft:17}}><li>A non-refundable deposit may be required to secure your booking.</li><li>Please arrive 10-15 minutes before your scheduled time.</li><li>Rescheduling is allowed up to 48 hours before the session.</li><li>Raw/unedited photos are not included.</li></ul></div>
          <div style={{background:goldSoft,padding:20}}><h3 style={{fontFamily:theme.headlineFont||'Georgia, serif',fontSize:15,marginTop:0}}>Have Questions?</h3><p style={{fontSize:11,lineHeight:1.6}}>We&apos;re here to help! Contact us for any inquiries or custom requests.</p><div style={{fontSize:11}}>☎ {store.phone || '(000) 123-0000'}</div><div style={{fontSize:11,marginTop:5}}>✉ {store.email || 'hello@verestudio.com'}</div></div>
        </section>
      </main>

      <footer style={{background:'#090909',color:'#fff',padding:'45px 5vw 18px'}}><div style={{maxWidth:1180,margin:'auto',display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr 1.2fr',gap:35}}><div><h3 style={{fontFamily:theme.headlineFont||'Georgia, serif',margin:'0 0 3px',fontSize:20}}>{store.name || 'VERE STUDIO'}</h3><small style={{letterSpacing:'.25em'}}>PHOTOGRAPHY</small><p style={{fontSize:11,lineHeight:1.7,color:'#bbb'}}>We capture moments that tell your story. Professional photography services for every occasion.</p><div>◯　◎　◉　♪　▶</div></div><div><b>Quick Links</b><div style={{fontSize:11,lineHeight:2,marginTop:10}}>Home<br/>About Us<br/>Services<br/>Portfolio<br/>Packages<br/>Blog<br/>Contact Us</div></div><div><b>Services</b><div style={{fontSize:11,lineHeight:2,marginTop:10}}>Portrait Photography<br/>Wedding Photography<br/>Event Photography<br/>Commercial Photography<br/>Family Photography<br/>Product Photography</div></div><div><b>Contact Us</b><div style={{fontSize:11,lineHeight:2,marginTop:10}}>⌖ {store.address || '2464 Royal Ln. Mesa, New Jersey 45463'}<br/>☎ {store.phone || '(000) 123-0000'}<br/>✉ {store.email || 'hello@verestudio.com'}</div><input className="photo-field" style={{marginTop:12}} placeholder="Enter your email" /></div></div><div style={{maxWidth:1180,margin:'30px auto 0',paddingTop:15,borderTop:'1px solid #333',fontSize:10,color:'#aaa'}}>© 2024 {store.name || 'Vere Studio Photography'}. All Rights Reserved.</div></footer>
    </div>
  );
            }
                                                                                                                     
