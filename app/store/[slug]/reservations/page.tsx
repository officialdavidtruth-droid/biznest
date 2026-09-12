import { notFound } from "next/navigation";
import { GrandeurReservations } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
export default async function ReservationsPage({ params }: { params: Promise<{ slug:string }> }) { const {slug}=await params; const data=await getGrandeurRestaurantData(slug); if(!data) notFound(); return <GrandeurReservations store={data.store} slug={slug} items={data.items}/>; }
