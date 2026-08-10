"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeliveryZone } from "@/lib/actions/delivery-zone";
import { toast } from "sonner";

export function DeliveryZoneForm({ storeSlug, currency }: { storeSlug: string; currency: string }) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [eta, setEta] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("city", city);
    formData.set("name", name);
    formData.set("fee", fee);
    if (eta) formData.set("estimatedMinutes", eta);
    const result = await createDeliveryZone(storeSlug, formData);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Zone added.");
    setCity("");
    setName("");
    setFee("");
    setEta("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:grid-cols-5">
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional, e.g. Abuja)" className="rounded-md border px-3 py-1.5 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gwarinpa" required className="rounded-md border px-3 py-1.5 text-sm" />
      <input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min="0" step="0.01" placeholder={`Fee (${currency})`} required className="rounded-md border px-3 py-1.5 text-sm" />
      <input value={eta} onChange={(e) => setEta(e.target.value)} type="number" min="0" placeholder="ETA (mins)" className="rounded-md border px-3 py-1.5 text-sm" />
      <button disabled={isSubmitting} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {isSubmitting ? "Adding…" : "Add zone"}
      </button>
    </form>
  );
}
