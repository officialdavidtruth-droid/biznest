"use client";
import { useState } from "react";
import { createRoom, createGuest, createReservation, updateRoomStatus, checkInReservation, checkOutReservation, setGuestPresence, cancelReservation, markReservationNoShow, chargeReservationDeposit } from "@/lib/actions/pms";
import { toast } from "sonner";

export function PmsControls({slug,rooms,guests,reservations}:{slug:string;rooms:any[];guests:any[];reservations:any[]}) {
 const [room,setRoom]=useState(""); const [roomType,setRoomType]=useState(""); const [guest,setGuest]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
 const [guestId,setGuestId]=useState(""); const [roomId,setRoomId]=useState(""); const [inDate,setInDate]=useState(""); const [outDate,setOutDate]=useState("");
 async function run(fn:()=>Promise<any>, reset?:()=>void){const r=await fn();if(!r.success)toast.error(r.error);else{toast.success("Saved");reset?.();location.reload();}}
 async function requestDeposit(reservationId:string){
  const amountStr=window.prompt("Deposit amount to charge (NGN):");
  if(!amountStr)return;
  const amount=Number(amountStr);
  if(!Number.isFinite(amount)||amount<=0){toast.error("Enter a valid amount.");return;}
  const r=await chargeReservationDeposit(slug,reservationId,amount);
  if(!r.success){toast.error(r.error);return;}
  await navigator.clipboard?.writeText(r.data.authorizationUrl).catch(()=>{});
  toast.success("Payment link copied — send it to the guest.");
  window.open(r.data.authorizationUrl,"_blank");
 }
 return <div className="space-y-6">
  <div className="grid gap-4 lg:grid-cols-3">
   <form className="rounded-2xl border p-4 space-y-3" onSubmit={e=>{e.preventDefault();run(()=>createRoom(slug,{name:room,roomType}),()=>{setRoom("");setRoomType("")})}}>
    <h2 className="font-semibold">Add room</h2><input className="input" value={room} onChange={e=>setRoom(e.target.value)} placeholder="Room 101"/><input className="input" value={roomType} onChange={e=>setRoomType(e.target.value)} placeholder="Deluxe Room"/><button className="btn">Add room</button>
   </form>
   <form className="rounded-2xl border p-4 space-y-3" onSubmit={e=>{e.preventDefault();run(()=>createGuest(slug,{fullName:guest,email,phone}),()=>{setGuest("");setEmail("");setPhone("")})}}>
    <h2 className="font-semibold">Add guest</h2><input className="input" value={guest} onChange={e=>setGuest(e.target.value)} placeholder="Full name"/><input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone"/><button className="btn">Create guest</button>
   </form>
   <form className="rounded-2xl border p-4 space-y-3" onSubmit={e=>{e.preventDefault();run(()=>createReservation(slug,{guestId,roomId,checkIn:inDate,checkOut:outDate}))}}>
    <h2 className="font-semibold">Create reservation</h2><select className="input" value={guestId} onChange={e=>setGuestId(e.target.value)}><option value="">Guest</option>{guests.map(g=><option key={g.id} value={g.id}>{g.fullName}</option>)}</select><select className="input" value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">Room</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name} — {r.roomType}</option>)}</select><input className="input" type="datetime-local" value={inDate} onChange={e=>setInDate(e.target.value)}/><input className="input" type="datetime-local" value={outDate} onChange={e=>setOutDate(e.target.value)}/><button className="btn">Reserve</button>
   </form>
  </div>
  <div className="rounded-2xl border p-4"><h2 className="mb-4 font-semibold">Room status</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rooms.map(r=><div key={r.id} className="rounded-xl bg-muted/50 p-3"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.roomType}</div><select className="input mt-2" value={r.status} onChange={e=>run(()=>updateRoomStatus(slug,r.id,e.target.value as any))}>{["AVAILABLE","OCCUPIED","RESERVED","DIRTY","CLEANING","MAINTENANCE","OUT_OF_SERVICE"].map(s=><option key={s}>{s}</option>)}</select></div>)}</div></div>
  <div className="rounded-2xl border p-4"><h2 className="mb-4 font-semibold">Reservations</h2><div className="space-y-3">{reservations.map(r=><div key={r.id} className="flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-medium">{r.guest.fullName} · {r.room.name}</div><div className="text-xs text-muted-foreground">{new Date(r.checkIn).toLocaleString()} → {new Date(r.checkOut).toLocaleString()} · {r.status} · Guest {r.guestPresence} · Payment {r.paymentStatus}{r.depositAmount?` (₦${Number(r.depositAmount).toLocaleString()})`:""}</div></div><div className="flex flex-wrap gap-2">{["PENDING","CONFIRMED"].includes(r.status)&&<><button className="btn" onClick={()=>run(()=>checkInReservation(slug,r.id))}>Check in</button><button className="btn btn-outline" onClick={()=>{if(confirm("Cancel this reservation?"))run(()=>cancelReservation(slug,r.id))}}>Cancel</button><button className="btn btn-outline" onClick={()=>{if(confirm("Mark this reservation as a no-show?"))run(()=>markReservationNoShow(slug,r.id))}}>No-show</button>{r.paymentStatus!=="PAID"&&<button className="btn btn-outline" onClick={()=>requestDeposit(r.id)}>Request payment</button>}</>}{r.status==="CHECKED_IN"&&<><button className="btn" onClick={()=>run(()=>setGuestPresence(slug,r.id,r.guestPresence==="IN"?"OUT":"IN"))}>{r.guestPresence==="IN"?"Mark OUT":"Mark IN"}</button><button className="btn" onClick={()=>run(()=>checkOutReservation(slug,r.id))}>Check out</button>{r.paymentStatus!=="PAID"&&<button className="btn btn-outline" onClick={()=>requestDeposit(r.id)}>Request payment</button>}</>}</div></div>)}</div></div>
  <style jsx>{`.input{width:100%;border:1px solid hsl(var(--border));border-radius:.6rem;padding:.55rem .7rem;background:hsl(var(--background));font-size:.875rem}.btn{border-radius:.6rem;background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:.55rem .8rem;font-size:.8rem;font-weight:600}.btn-outline{background:transparent;border:1px solid hsl(var(--border));color:hsl(var(--foreground))}`}</style>
 </div>
}
