"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupplier, updateSupplier, type SupplierInput } from "@/lib/actions/supplier";

export function SupplierForm({
  storeSlug,
  supplierId,
  initial,
}: {
  storeSlug: string;
  supplierId?: string;
  initial?: SupplierInput;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    const input: SupplierInput = { name, contactName, email, phone, notes };
    const result = supplierId
      ? await updateSupplier(storeSlug, supplierId, input)
      : await createSupplier(storeSlug, input);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(supplierId ? "Supplier updated" : "Supplier added");
    router.push(`/store/${storeSlug}/admin/suppliers`);
    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-4">
      <label className="block text-sm">
        Supplier name
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        Contact name
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-sm">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : supplierId ? "Save changes" : "Add supplier"}
      </button>
    </div>
  );
}
