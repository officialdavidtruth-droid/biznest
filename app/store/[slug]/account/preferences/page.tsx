import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerPreferences } from "@/lib/actions/account";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { VelouraPreferencesForm } from "@/components/storefront/veloura-preferences-form";
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const[store,prefs,hotel]=await Promise.all([getStoreBranding(slug),getStoreCustomerPreferences(slug),getHotelContent(slug)]);if(!store)notFound();return <div className="veloura-account-content"><VelouraAccountHero title="Preferences" subtitle="Customize your stay experience. Tell us what you like and we’ll make every visit feel just right." image={hotel.rooms[0]?.image||null}/><VelouraPreferencesForm slug={slug} initial={prefs||{}}/><div className="veloura-security" style={{marginTop:12}}><strong>Your Privacy Matters</strong><p>Your preferences are stored for your account at this hotel and used to personalize eligible experiences.</p></div></div>}
