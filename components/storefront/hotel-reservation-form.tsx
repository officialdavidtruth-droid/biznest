"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createStayBooking } from "@/lib/actions/booking";
import { startBookingPayment } from "@/lib/actions/customer-wallet";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";

function today() { return new Date().toISOString().slice(0, 10); }
function tomorrow() { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function nights(a:string,b:string){ if(!a||!b)return 0; return Math.max(0,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000)); }

export function HotelReservationForm({storeSlug,service,accent,card,ink,bg,radius}:{storeSlug:string;service:any;accent:string;card:string;ink:string;bg:string;radius:string}) {
  const [checkIn,setCheckIn]=useState(today());
  const [checkOut,setCheckOut]=useState(tomorrow());
  const [adults,setAdults]=useState("2 Adults");
  const [children,setChildren]=useState("0 Children");
  const [rooms,setRooms]=useState("1 Room");
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [email,setEmail]=useState("");
  const [pending,startTransition]=useTransition(); const {isSignedIn}=useShopAuthGate(storeSlug);
  const n=nights(checkIn,checkOut); const total=Number(service.price)*(n||1);
  function submit(e:React.FormEvent){ e.preventDefault(); if(checkOut<=checkIn){toast.error("Check-out must be after check-in.");return;} if(rooms!=="1 Room"){toast.error("Please make a separate reservation for each room.");return;} if(!isSignedIn && (!name.trim()||!phone.trim()||!email.trim())){toast.error("Please enter your name, phone and email.");return;}
    const guest=isSignedIn?undefined:{name,email,phone}; const notes=`Adults: ${adults}\nChildren: ${children}\nRooms: ${rooms}`;
    startTransition(async()=>{const result=await createStayBooking(storeSlug,service.id,checkIn,checkOut,notes,guest); if(!result.success){toast.error(result.error);return;} const pay=await startBookingPayment(storeSlug,result.data.bookingId,isSignedIn?undefined:email); if(!pay.success){toast.error(pay.error);return;} window.location.assign(pay.data.authorizationUrl);});
  }
  return <form className="hr-book-card" onSubmit={submit}>
    <h3>Book Room</h3>
    {!isSignedIn && <><label>Your Name *<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. John Doe" /></label><label>Phone Number *<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter Phone Number" inputMode="tel" /></label><label>Email *<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" type="email" /></label></>}
    <label>Check-in Date *<input value={checkIn} min={today()} onChange={e=>setCheckIn(e.target.value)} type="date" /></label>
    <label>Check-out Date *<input value={checkOut} min={checkIn || tomorrow()} onChange={e=>setCheckOut(e.target.value)} type="date" /></label>
    <label>Adult *<select value={adults} onChange={e=>setAdults(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n}>{n} Adult{n===1?"":"s"}</option>)}</select></label>
    <label>Children *<select value={children} onChange={e=>setChildren(e.target.value)}>{[0,1,2,3,4].map(n=><option key={n}>{n} Children</option>)}</select></label>
    <label>Room Type *<select defaultValue={service.id}><option value={service.id}>{service.name}</option></select></label>
    <label>Number of Rooms *<select value={rooms} onChange={e=>setRooms(e.target.value)}>{[1,2,3,4].map(n=><option key={n}>{n} Room{n===1?"":"s"}</option>)}</select></label>
    <button disabled={pending} type="submit">{pending?"Securing Room…":"Book Now"}</button>
    <small>{n>0 ? `${n} night${n===1?"":"s"} · ${service.currency} ${total.toLocaleString()}` : "Select your dates"}</small>
  </form>
}
