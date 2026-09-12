import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { listStoreAddresses } from "@/lib/actions/account";
import { StoreAddressManager } from "@/components/account/store-address-manager";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const {slug}=await params; const store=await getStoreBranding(slug); if(!store) notFound(); const addresses=await listStoreAddresses(slug); return <StoreAddressManager storeSlug={slug} initialAddresses={addresses}/>; }
