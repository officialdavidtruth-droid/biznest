import { getPluginAdminData } from "@/lib/actions/plugin-admin";
import { PluginAdminManager } from "@/components/dashboard/plugin-admin-manager";

export default async function SupaAdminAppsPage() {
  const data = await getPluginAdminData();
  if (!data) return null;
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wider" style={{color:"var(--bn-marigold)"}}>Marketplace control</p><h1 className="mt-1 text-xl font-bold">Apps & Plugins</h1><p className="mt-1 text-xs text-muted-foreground">Control plugin pricing, free/included status, supported subscription plans, business eligibility and publication state.</p></div><PluginAdminManager plugins={data.plugins} plans={data.plans}/></div>;
}
