"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addStoreAddress, deleteStoreAddress, setDefaultStoreAddress } from "@/lib/actions/account";

export function StoreAddressManager({ storeSlug, initialAddresses }: { storeSlug: string; initialAddresses: any[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [saving, setSaving] = useState(false);

  async function add(form: HTMLFormElement) {
    const data = new FormData(form);
    setSaving(true);
    const result = await addStoreAddress(storeSlug, {
      label: String(data.get("label") || ""), fullName: String(data.get("fullName") || ""), phone: String(data.get("phone") || ""),
      line1: String(data.get("line1") || ""), line2: String(data.get("line2") || ""), city: String(data.get("city") || ""),
      state: String(data.get("state") || ""), country: String(data.get("country") || "Nigeria"), isDefault: data.get("isDefault") === "on",
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Address saved to this store");
    form.reset();
    window.location.reload();
  }

  return <div className="space-y-5">
    <div>
      <h1 className="text-xl font-bold text-slate-900">My Addresses</h1>
      <p className="mt-1 text-sm text-slate-500">Addresses saved here belong only to this store.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {addresses.map((a) => <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{a.label || "Address"}</p><p className="mt-1 text-sm text-slate-600">{a.fullName}</p></div>{a.isDefault && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Default</span>}</div>
        <p className="mt-3 text-sm text-slate-500">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state}<br />{a.phone}</p>
        <div className="mt-4 flex gap-3 text-xs font-semibold">
          {!a.isDefault && <button onClick={async()=>{const r=await setDefaultStoreAddress(storeSlug,a.id); if(r.success){setAddresses((x)=>x.map((v)=>({...v,isDefault:v.id===a.id})));toast.success("Default address updated")}else toast.error(r.error)}} className="text-blue-600">Make default</button>}
          <button onClick={async()=>{const r=await deleteStoreAddress(storeSlug,a.id); if(r.success){setAddresses((x)=>x.filter((v)=>v.id!==a.id));toast.success("Address removed")}else toast.error(r.error)}} className="text-red-600">Remove</button>
        </div>
      </div>)}
      {addresses.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No addresses saved for this store yet.</div>}
    </div>
    <form onSubmit={(e)=>{e.preventDefault(); void add(e.currentTarget)}} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Add an address</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="label" placeholder="Label (Home, Office)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input name="fullName" placeholder="Full name *" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone *" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input name="line1" placeholder="Address line 1 *" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <input name="line2" placeholder="Address line 2" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <input name="city" placeholder="City *" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input name="state" placeholder="State *" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input name="country" defaultValue="Nigeria" placeholder="Country" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input name="isDefault" type="checkbox" /> Make default</label>
      </div>
      <button disabled={saving} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save address"}</button>
    </form>
  </div>;
}
