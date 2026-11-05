"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveOrderDelivery } from "@/lib/actions/delivery";
import { DELIVERY_STATUSES, deliveryStatusLabel, type DeliveryStatus } from "@/lib/delivery";

export function DeliveryPanel({
  storeSlug,
  orderId,
  initial,
  messagesOn,
}: {
  storeSlug: string;
  orderId: string;
  initial: { status: string | null; trackingUrl: string | null; riderName: string | null; riderPhone: string | null };
  messagesOn: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DeliveryStatus>((initial.status as DeliveryStatus) ?? "BOOKED");
  const [trackingUrl, setTrackingUrl] = useState(initial.trackingUrl ?? "");
  const [riderName, setRiderName] = useState(initial.riderName ?? "");
  const [riderPhone, setRiderPhone] = useState(initial.riderPhone ?? "");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await saveOrderDelivery(storeSlug, orderId, { status, trackingUrl, riderName, riderPhone, notifyCustomer: notify });
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    toast.success(res.data.messaged ? "Delivery saved and the customer was messaged." : "Delivery saved.");
    router.refresh();
  }

  const field = "w-full rounded-md border px-3 py-1.5 text-sm";
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Booked a rider yourself? Record them here. Your customer sees the tracking link on their orders page{messagesOn ? " and gets it by message" : ""}.
      </p>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Delivery status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as DeliveryStatus)} className={field}>
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>{deliveryStatusLabel(s)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Tracking link (optional)</label>
        <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" inputMode="url" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rider name (optional)</label>
          <input value={riderName} onChange={(e) => setRiderName(e.target.value)} maxLength={80} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rider phone (optional)</label>
          <input value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} maxLength={30} inputMode="tel" className={field} />
        </div>
      </div>
      {messagesOn && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Message the customer about this update
        </label>
      )}
      <button onClick={save} disabled={busy} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
        {busy ? "Saving…" : "Save delivery"}
      </button>
    </div>
  );
}
