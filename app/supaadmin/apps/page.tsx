import { getPluginAdminData } from "@/lib/actions/plugin-admin";
import { PluginAdminManager } from "@/components/dashboard/plugin-admin-manager";

export default async function SupaAdminAppsPage() {
  const data = await getPluginAdminData();
  if (!data) return null;

  return (
    <div className="space-y-5 text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Marketplace control</p>
        <h1 className="mt-1 text-xl font-bold text-white">Apps &amp; Plugins</h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
          Control plugin pricing, free/included status, supported subscription plans, business eligibility and publication state.
        </p>
      </div>
      <PluginAdminManager plugins={data.plugins} plans={data.plans} />
    </div>
  );
}
