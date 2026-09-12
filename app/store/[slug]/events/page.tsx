import { notFound } from "next/navigation";
import { GrandeurEvents } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { getGrandeurEvents } from "@/lib/grandeur-content";
export default async function EventsPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const [data,events]=await Promise.all([getGrandeurRestaurantData(slug),getGrandeurEvents(slug)]);if(!data)notFound();return <GrandeurEvents store={data.store} slug={slug} items={data.items} content={events}/>;}
