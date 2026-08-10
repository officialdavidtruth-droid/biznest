"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cashOutLoyaltyPoints } from "@/lib/actions/loyalty";
import { toast } from "sonner";

type StoreOption = { id: string; name: string };

export function LoyaltyCashoutForm({
  pointsBalance,
  nairaPerPoint,
  stores,
}: {
  pointsBalance: number;
  nairaPerPoint: number;
  stores: StoreOption[];
}) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [points, setPoints] = useState(Math.min(100, pointsBalance));
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (stores.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Follow or shop with a business first — points are cashed out as a coupon for a specific store.
      </p>
    );
  }

  const discountPreview = Math.max(0, points) * nairaPerPoint;

  async function handleCashOut() {
    if (points <= 0 || points > pointsBalance) {
      toast.error("Enter a valid number of points.");
      return;
    }
    setIsSubmitting(true);
    const result = await cashOutLoyaltyPoints(storeId, points);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Coupon ${result.data.couponCode} created — worth ₦${result.data.discountValue.toLocaleString()}`);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Redeem at</label>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Points to cash out (you have {pointsBalance.toLocaleString()})
        </label>
        <input
          type="number"
          min={1}
          max={pointsBalance}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <p className="text-sm text-slate-500">
        You'll get a one-time coupon worth <span className="font-semibold text-slate-900">₦{discountPreview.toLocaleString()}</span>, usable only at the store you selected.
      </p>

      <button
        onClick={handleCashOut}
        disabled={isSubmitting || pointsBalance === 0}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {isSubmitting ? "Cashing out…" : "Cash out points"}
      </button>
    </div>
  );
}
