"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDeliveryZone, deleteDeliveryZone, toggleDeliveryZone } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";

type Zone = {
  id: string;
  city: string | null;
  name: string;
  fee: number | string;
  estimatedMinutes: number | null;
  isActive: boolean;
};

export function DeliveryZoneRow({ storeSlug, currency, zone }: { storeSlug: string; currency: string; zone: Zone }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [city, setCity] = useState(zone.city ?? "");
  const [name, setName] = useState(zone.name);
  const [fee, setFee] = useState(String(zone.fee));
  const [eta, setEta] = useState(zone.estimatedMinutes ? String(zone.estimatedMinutes) : "");

  async function handleSave() {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("city", city);
    formData.set("name", name);
    formData.set("fee", fee);
    if (eta) formData.set("estimatedMinutes", eta);
    const result = await updateDeliveryZone(storeSlug, zone.id, formData);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Zone updated.");
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Remove "${zone.name}"?`)) return;
    setIsSubmitting(true);
    const result = await deleteDeliveryZone(storeSlug, zone.id);
    setIsSubmitting(false);

    if (!result.success) {
      // Zones with past orders get deactivated instead — surface that as info, not an error.
      toast.info(result.error);
      router.refresh();
      return;
    }
    toast.success("Zone removed.");
    router.refresh();
  }

  async function handleToggle() {
    setIsSubmitting(true);
    await toggleDeliveryZone(storeSlug, zone.id, !zone.isActive);
    setIsSubmitting(false);
    router.refresh();
  }

  if (editing) {
    return (
      <tr className="border-b bg-muted/20 last:border-0">
        <td className="px-4 py-2" colSpan={5}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" className="rounded-md border px-3 py-1.5 text-sm" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zone name" className="rounded-md border px-3 py-1.5 text-sm" />
            <input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min="0" step="0.01" placeholder={`Fee (${currency})`} className="rounded-md border px-3 py-1.5 text-sm" />
            <input value={eta} onChange={(e) => setEta(e.target.value)} type="number" min="0" placeholder="ETA (mins)" className="rounded-md border px-3 py-1.5 text-sm" />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={isSubmitting || !name.trim()} className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setEditing(false)} disabled={isSubmitting} className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 text-muted-foreground">{zone.city ?? "—"}</td>
      <td className="px-4 py-3 font-medium">{zone.name}</td>
      <td className="px-4 py-3">{currency} {Number(zone.fee).toLocaleString()}</td>
      <td className="px-4 py-3 text-muted-foreground">{zone.estimatedMinutes ? `${zone.estimatedMinutes} min` : "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={isSubmitting}
            className={`rounded-full px-2 py-0.5 text-xs ${zone.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
          >
            {zone.isActive ? "Active" : "Inactive"}
          </button>
          <button onClick={() => setEditing(true)} disabled={isSubmitting} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Edit
          </button>
          <button onClick={handleDelete} disabled={isSubmitting} className="text-xs font-medium text-destructive hover:underline">
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
