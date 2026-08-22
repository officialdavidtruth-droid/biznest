"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateMaintenanceSetting,
  updateAnnouncementSetting,
  setActiveGateway,
  updateLoyaltyRates,
  updateFreeTrialSetting,
  type MaintenanceValue,
  type AnnouncementValue,
  type ActiveGateway,
  type LoyaltyRates,
  type FreeTrialValue,
} from "@/lib/actions/site-settings";
import { updatePlanPricing } from "@/lib/actions/admin";

// --- Maintenance mode --------------------------------------------------

export function MaintenanceForm({ initial }: { initial: MaintenanceValue }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateMaintenanceSetting({ enabled, message });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(enabled ? "Maintenance mode is now ON — visitors will see the message below." : "Maintenance mode is off.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Maintenance mode</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? "On" : "Off"}
        </label>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        When on, visitors (except platform admins) see this message instead of the site.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="We're doing some scheduled maintenance and will be back shortly."
        rows={3}
        className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// --- Announcement banner -------------------------------------------------

export function AnnouncementForm({ initial }: { initial: AnnouncementValue }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [tone, setTone] = useState(initial.tone);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateAnnouncementSetting({ enabled, message, tone });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Announcement updated.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Site announcement</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? "Showing" : "Hidden"}
        </label>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">A dismissible banner shown site-wide — for launches, downtime notices, promos, etc.</p>
      <div className="mb-3 flex gap-2">
        {(["info", "warning", "success"] as const).map((t) => (
          <label key={t} className="flex items-center gap-1 text-xs capitalize">
            <input type="radio" name="tone" checked={tone === t} onChange={() => setTone(t)} />
            {t}
          </label>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="New: custom domains are now live on Enterprise plans!"
        rows={2}
        className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// --- Payment gateway toggle ------------------------------------------------

export function GatewayToggle({
  active,
  paystackConfigured,
  flutterwaveConfigured,
}: {
  active: ActiveGateway;
  paystackConfigured: boolean;
  flutterwaveConfigured: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function activate(gateway: ActiveGateway) {
    setSaving(true);
    const result = await setActiveGateway(gateway);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${gateway === "PAYSTACK" ? "Paystack" : "Flutterwave"} is now the active gateway everywhere on the platform.`);
    router.refresh();
  }

  const gateways: { id: ActiveGateway; label: string; configured: boolean }[] = [
    { id: "PAYSTACK", label: "Paystack", configured: paystackConfigured },
    { id: "FLUTTERWAVE", label: "Flutterwave", configured: flutterwaveConfigured },
  ];

  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-1 text-sm font-semibold">Active payment gateway</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Whichever gateway is active handles every checkout and plan upgrade on the platform. Add its secret key to your
        environment variables first (PAYSTACK_SECRET_KEY / FLUTTERWAVE_SECRET_KEY), then activate it here.
      </p>
      <div className="space-y-2">
        {gateways.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{g.label}</p>
              <p className="text-xs text-muted-foreground">
                {g.configured ? "API key configured" : "No API key set in environment variables"}
              </p>
            </div>
            {active === g.id ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">Active</span>
            ) : (
              <button
                onClick={() => activate(g.id)}
                disabled={saving || !g.configured}
                className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-40"
              >
                Make active
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Plan pricing editor ---------------------------------------------------

type Plan = { id: string; name: string; price: number; commissionRate: number; isActive: boolean; interval: string };

export function PlanPricingRow({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(plan.price));
  const [commission, setCommission] = useState(String(plan.commissionRate));
  const [isActive, setIsActive] = useState(plan.isActive);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updatePlanPricing(plan.id, {
      price: Number(price),
      commissionRate: Number(commission),
      isActive,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${plan.name} updated — this reflects on the landing page and upgrade screens immediately.`);
    router.refresh();
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{plan.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{plan.interval}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">₦</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            className="w-24 rounded-md border px-2 py-1 text-sm"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            type="number"
            min={0}
            max={100}
            className="w-16 rounded-md border px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {isActive ? "Visible" : "Retired"}
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

// --- Loyalty rates --------------------------------------------------------

export function LoyaltyRatesForm({ initial }: { initial: LoyaltyRates }) {
  const router = useRouter();
  const [pointsPerNaira, setPointsPerNaira] = useState(String(initial.pointsPerNaira));
  const [nairaPerPoint, setNairaPerPoint] = useState(String(initial.nairaPerPoint));
  const [saving, setSaving] = useState(false);

  const pointsPerNairaNum = Number(pointsPerNaira);
  const nairaPerPointNum = Number(nairaPerPoint);
  const sampleSpend = 10000;
  const samplePoints = pointsPerNairaNum > 0 ? Math.floor(sampleSpend * pointsPerNairaNum) : 0;
  const sampleValue = nairaPerPointNum > 0 ? samplePoints * nairaPerPointNum : 0;

  async function handleSave() {
    if (pointsPerNairaNum <= 0 || nairaPerPointNum <= 0) {
      toast.error("Loyalty rates must be greater than zero.");
      return;
    }
    setSaving(true);
    const result = await updateLoyaltyRates({ pointsPerNaira: pointsPerNairaNum, nairaPerPoint: nairaPerPointNum });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Loyalty rates updated.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-1 text-sm font-semibold">Loyalty rate</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Applies platform-wide — how customers earn points on orders, and what those points are worth when cashed out.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Points earned per ₦1 spent
          <input
            value={pointsPerNaira}
            onChange={(e) => setPointsPerNaira(e.target.value)}
            type="number"
            min="0"
            step="0.0001"
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          ₦ value per point cashed out
          <input
            value={nairaPerPoint}
            onChange={(e) => setNairaPerPoint(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Example: a ₦{sampleSpend.toLocaleString()} order earns {samplePoints.toLocaleString()} points, worth ₦{sampleValue.toLocaleString()} if cashed out.
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// --- Free trial (billing) ------------------------------------------------

export function FreeTrialForm({
  initial,
  paidPlans,
}: {
  initial: FreeTrialValue;
  paidPlans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [planId, setPlanId] = useState(initial.planId ?? paidPlans[0]?.id ?? "");
  const [days, setDays] = useState(String(initial.days));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const daysNum = Number(days);
    setSaving(true);
    const result = await updateFreeTrialSetting({ enabled, planId: enabled ? planId || null : initial.planId, days: daysNum });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Free trial settings updated.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Free trial</h3>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`h-5 w-9 rounded-full transition ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`block h-4 w-4 rounded-full bg-background transition ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        When on, new stores get a free trial on exactly one paid plan (chosen below) instead of being charged the first time they pick it. Every other plan is unaffected.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Plan
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={!enabled}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {paidPlans.length === 0 && <option value="">No paid plans</option>}
            {paidPlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Trial length (days)
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            type="number"
            min="1"
            max="365"
            step="1"
            disabled={!enabled}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          />
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
