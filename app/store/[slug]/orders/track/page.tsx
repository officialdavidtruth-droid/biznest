import { notFound } from "next/navigation";
import { GrandeurTrack } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
export default async function TrackPage({ params }: { params: Promise<{ slug:string }> }) { const {slug}=await params; const data=await getGrandeurRestaurantData(slug); if(!data) notFound(); return <GrandeurTrack store={data.store} slug={slug}/>; }
