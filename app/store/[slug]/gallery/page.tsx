import { notFound } from "next/navigation";
import { GrandeurGallery } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { getGrandeurGallery } from "@/lib/grandeur-content";
export default async function GalleryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const [data,gallery]=await Promise.all([getGrandeurRestaurantData(slug),getGrandeurGallery(slug)]);if(!data)notFound();return <GrandeurGallery store={data.store} slug={slug} items={data.items} content={gallery}/>;}
