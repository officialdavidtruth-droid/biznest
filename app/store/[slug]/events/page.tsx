import { notFound } from "next/navigation";
import { GrandeurEvents } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
export default async function EventsPage({ params }: { params: Promise<{ slug:string }> }) { const {slug}=await params; const data=await getGrandeurRestaurantData(slug); if(!data) notFound(); return <GrandeurEvents store={data.store} slug={slug} items={data.items}/>; }
