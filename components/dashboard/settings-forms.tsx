"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateMaintenanceSetting,
  updateAnnouncementSetting,
  setActiveGateway,
  type MaintenanceValue,
  type AnnouncementValue,
  type ActiveGateway,
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
