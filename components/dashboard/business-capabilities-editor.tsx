"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, CalendarClock } from "lucide-react";
import { updateBusinessCapabilities } from "@/lib/actions/store";

/**
 * Lets the business owner flip what their business sells after the fact.
 * The dashboard nav, storefront layout, and everything else that reads
 * Business.sellsProducts/offersServices already re-fetches fresh on every
 * request — this component just needs to persist the change and refresh
 * the current route so the nav updates immediately, without a manual reload.
 */
export function BusinessCapabilitiesEditor({
  slug,
  initialSellsProducts,
  initialOffersServices,
}: {
  slug: string;
  initialSellsProducts: boolean;
  initialOffersServices: boolean;
}) {
  const router = useRouter();
  const [sellsProducts, setSellsProducts] = useState(initialSellsProducts);
  const [offersServices, setOffersServices] = useState(initialOffersServices);
  const [saving, setSaving] = useState(false);

  const dirty = sellsProducts !== initialSellsProducts || offersServices !== initialOffersServices;
  const canSave = dirty && (sellsProducts || offersServices) && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await updateBusinessCapabilities(slug, { sellsProducts, offersServices });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Updated — your dashboard and storefront now reflect this.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">What does your business do?</p>
      <p className="mb-3 text-xs text-muted-foreground">
        This controls what shows up in your dashboard and on your storefront. Changing it takes
        effect immediately for you and any staff.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors ${sellsProducts ? "border-primary bg-primary/5" : "border-border"}`}>
          <input type="checkbox" className="sr-only" checked={sellsProducts} onChange={(e) => setSellsProducts(e.target.checked)} />
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${sellsProducts ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Package className="h-4 w-4" strokeWidth={2} />
          </span>
          <span>
            <span className="block font-medium">I sell products</span>
            <span className="block text-xs text-muted-foreground">Physical goods, digital downloads, or rentals.</span>
          </span>
        </label>

        <label className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors ${offersServices ? "border-primary bg-primary/5" : "border-border"}`}>
          <input type="checkbox" className="sr-only" checked={offersServices} onChange={(e) => setOffersServices(e.target.checked)} />
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${offersServices ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <CalendarClock className="h-4 w-4" strokeWidth={2} />
          </span>
          <span>
            <span className="block font-medium">I offer services</span>
            <span className="block text-xs text-muted-foreground">Appointments or bookings instead of shipping.</span>
          </span>
        </label>
      </div>

      {!sellsProducts && !offersServices && (
        <p className="mt-2 text-xs text-destructive">Select at least one — you can't turn both off.</p>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="mt-3 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
