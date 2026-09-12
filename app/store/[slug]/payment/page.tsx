import { notFound } from "next/navigation";
import { GrandeurPayment } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
export default async function PaymentPage({ params }: { params: Promise<{ slug:string }> }) { const {slug}=await params; const data=await getGrandeurRestaurantData(slug); if(!data) notFound(); return <GrandeurPayment store={data.store} slug={slug}/>; }
