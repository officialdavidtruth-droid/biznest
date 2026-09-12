import { notFound } from "next/navigation";
import { GrandeurGallery } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
export default async function GalleryPage({ params }: { params: Promise<{ slug:string }> }) { const {slug}=await params; const data=await getGrandeurRestaurantData(slug); if(!data) notFound(); return <GrandeurGallery store={data.store} slug={slug} items={data.items}/>; }
