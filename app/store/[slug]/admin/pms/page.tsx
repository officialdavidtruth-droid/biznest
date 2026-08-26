// Route: /store/[slug]/admin/pms
import { getPmsData } from "@/lib/actions/pms";
import { notFound } from "next/navigation";
import { PmsControls } from "@/components/dashboard/pms-controls";

export default async function PmsPage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const data=await getPmsData(slug); if(!data) notFound();
 return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
  <div><h1 className="text-2xl font-semibold">Property Management</h1><p className="mt-1 text-sm text-muted-foreground">Rooms, guests, reservations, check-in/out and operational room status.</p></div>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[
   ["Available",data.rooms.filter(r=>r.status==="AVAILABLE").length],["Occupied",data.rooms.filter(r=>r.status==="OCCUPIED").length],["Reserved",data.rooms.filter(r=>r.status==="RESERVED").length],["Cleaning",data.rooms.filter(r=>r.status==="CLEANING"||r.status==="DIRTY").length],["Guests",data.reservations.filter(r=>r.status==="CHECKED_IN").length],
  ].map(([l,n])=><div key={String(l)} className="rounded-2xl border p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 text-2xl font-semibold">{n}</div></div>)}</div>
  <PmsControls slug={slug} rooms={data.rooms} guests={data.guests} reservations={data.reservations}/>
 </div>
}
