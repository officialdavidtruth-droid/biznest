import { getMaintenanceSetting, getAnnouncementSetting, getGatewayAvailability } from "@/lib/actions/site-settings";
import { listPlans } from "@/lib/actions/admin";
import { MaintenanceForm, AnnouncementForm, GatewayToggle, PlanPricingRow } from "@/components/dashboard/settings-forms";

export default async function SupaAdminSettingsPage() {
  const [maintenance, announcement, gatewayAvailability, plans] = await Promise.all([
    getMaintenanceSetting(),
    getAnnouncementSetting(),
    getGatewayAvailability(),
    listPlans(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Site control, payments, and billing — changes here apply platform-wide immediately.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site control</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <MaintenanceForm initial={maintenance} />
          <AnnouncementForm initial={announcement} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payments</h2>
        <GatewayToggle
          active={gatewayAvailability.active}
          paystackConfigured={gatewayAvailability.paystackConfigured}
          flutterwaveConfigured={gatewayAvailability.flutterwaveConfigured}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Billing — plan pricing</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          These prices feed the landing page pricing section and every store owner&apos;s upgrade screen directly — there&apos;s nowhere else to edit them.
        </p>
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Billing</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Commission</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanPricingRow
                  key={p.id}
                  plan={{ id: p.id, name: p.name, price: Number(p.price), commissionRate: Number(p.commissionRate), isActive: p.isActive, interval: p.interval }}
                />
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No plans yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
