import Link from "next/link";
import { Calculator, Hotel, Users, BriefcaseBusiness, ClipboardList, BarChart3, ChefHat, LifeBuoy, Boxes, Scale, Truck, Gift, LockKeyhole, Puzzle } from "lucide-react";
import { getStoreApps } from "@/lib/actions/plugins";
import { PluginUseButton } from "@/components/dashboard/plugin-use-button";

const ICONS: Record<string, typeof Puzzle> = { Calculator, Hotel, Users, BriefcaseBusiness, ClipboardList, BarChart3, ChefHat, LifeBuoy, Boxes, Scale, Truck, Gift };

export default async function AppsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStoreApps(slug);
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">BizNest Marketplace</p>
        <h1 className="mt-1 text-2xl font-bold">Apps</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Extend your business workspace with purpose-built apps. Your current plan and business type determine which apps you can use.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.plugins.map((plugin) => {
          const Icon = ICONS[plugin.icon ?? ""] ?? Puzzle;
          const unavailable = !plugin.eligible || !plugin.planAllowed;
          return (
            <div key={plugin.key} className="flex min-h-[245px] flex-col rounded-2xl border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></div>
                {plugin.installed ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">Installed</span> : plugin.isComingSoon ? <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">Coming soon</span> : null}
              </div>
              <h2 className="mt-4 text-base font-bold">{plugin.name}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-muted-foreground">{plugin.description}</p>
              <div className="mt-4 flex items-end justify-between gap-3 border-t pt-4">
                <div>
                  {plugin.isFree ? <p className="text-sm font-bold text-primary">Included in plan</p> : <p className="text-sm font-bold">₦{plugin.price.toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground">/{plugin.billingInterval === "YEARLY" ? "year" : plugin.billingInterval === "ONE_TIME" ? "one time" : "month"}</span></p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{plugin.supportedPlans.length ? `Available on ${plugin.supportedPlans.join(" / ")}` : "Plan access not configured"}</p>
                </div>
                {plugin.isComingSoon ? <span className="rounded-xl border px-4 py-2 text-xs font-semibold text-muted-foreground">Coming soon</span> : unavailable ? (
                  <Link href={`/store/${slug}/admin/subscription?apps=${encodeURIComponent(plugin.key)}`} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"><LockKeyhole size={13} /> Upgrade</Link>
                ) : <PluginUseButton slug={slug} pluginKey={plugin.key} isFree={plugin.isFree} installed={plugin.installed} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
