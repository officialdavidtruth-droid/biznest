"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addAddress, deleteAddress, setDefaultAddress } from "@/lib/actions/account";
import { MapPin, Star, Trash2, Plus } from "lucide-react";

type Address = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
};

export function AddressManager({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAdd(formData: FormData) {
    setSaving(true);
    const result = await addAddress({
      label: String(formData.get("label") || "") || undefined,
      fullName: String(formData.get("fullName") || ""),
      phone: String(formData.get("phone") || ""),
      line1: String(formData.get("line1") || ""),
      line2: String(formData.get("line2") || "") || undefined,
      city: String(formData.get("city") || ""),
      state: String(formData.get("state") || ""),
      isDefault: addresses.length === 0,
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Address saved.");
    setShowForm(false);
    window.location.reload();
  }

  async function handleDelete(id: string) {
    const result = await deleteAddress(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    toast.success("Address removed.");
  }

  async function handleSetDefault(id: string) {
    const result = await setDefaultAddress(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    toast.success("Default address updated.");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Used to prefill checkout across every BizNest store.</p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" /> Add address
        </button>
      </div>

      {showForm && (
        <form
          action={handleAdd}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
        >
          <input name="label" placeholder="Label (Home, Office...)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="fullName" placeholder="Full name *" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Phone *" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="line1" placeholder="Address line 1 *" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <input name="line2" placeholder="Address line 2" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <input name="city" placeholder="City *" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="state" placeholder="State *" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 sm:col-span-2"
          >
            {saving ? "Saving..." : "Save address"}
          </button>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {a.label || "Address"}
                  {a.isDefault && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {!a.isDefault && (
                    <button onClick={() => handleSetDefault(a.id)} title="Set as default" className="rounded p-1 text-slate-400 hover:text-amber-500">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(a.id)} title="Remove" className="rounded p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-slate-700">{a.fullName}</div>
              <div className="text-xs text-slate-500">{a.phone}</div>
              <div className="mt-1 text-xs text-slate-500">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
