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

  return <div className="bn-account-addresses">
    <div className="bn-account-addresses-intro"><span>PROFILE</span><h2>Saved addresses</h2><p>Addresses saved here belong only to this store.</p></div>
    <div className="bn-account-address-grid">
      {addresses.map((a) => <div key={a.id} className="bn-account-address-card">
        <div className="bn-account-address-head"><div><strong>{a.label || "Address"}</strong><span>{a.fullName}</span></div>{a.isDefault && <b>Default</b>}</div>
        <p className="bn-account-address-copy">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state}<br />{a.phone}</p>
        <div className="bn-account-address-actions">
          {!a.isDefault && <button onClick={async()=>{const r=await setDefaultStoreAddress(storeSlug,a.id); if(r.success){setAddresses((x)=>x.map((v)=>({...v,isDefault:v.id===a.id})));toast.success("Default address updated")}else toast.error(r.error)}} className="make-default">Make default</button>}
          <button onClick={async()=>{const r=await deleteStoreAddress(storeSlug,a.id); if(r.success){setAddresses((x)=>x.filter((v)=>v.id!==a.id));toast.success("Address removed")}else toast.error(r.error)}} className="remove">Remove</button>
        </div>
      </div>)}
      {addresses.length===0 && <div className="bn-account-address-empty">No addresses saved for this store yet.</div>}
    </div>
    <form onSubmit={(e)=>{e.preventDefault(); void add(e.currentTarget)}} className="bn-account-address-form">
      <div className="bn-account-address-form-head"><span>NEW ADDRESS</span><h2>Add an address</h2><p>Save a delivery or contact address for faster checkout.</p></div>
      <div className="bn-account-form-grid">
        <input name="label" placeholder="Label (Home, Office)" className="bn-account-input" />
        <input name="fullName" placeholder="Full name *" required className="bn-account-input" />
        <input name="phone" placeholder="Phone *" required className="bn-account-input" />
        <input name="line1" placeholder="Address line 1 *" required className="bn-account-input bn-account-input-wide" />
        <input name="line2" placeholder="Address line 2" className="bn-account-input bn-account-input-wide" />
        <input name="city" placeholder="City *" required className="bn-account-input" />
        <input name="state" placeholder="State *" required className="bn-account-input" />
        <input name="country" defaultValue="Nigeria" placeholder="Country" className="bn-account-input" />
        <label className="bn-account-check"><input name="isDefault" type="checkbox" /> Make default</label>
      </div>
      <button disabled={saving} className="bn-account-save-button">{saving ? "Saving…" : "Save address"}</button>
    </form>
  </div>;
}
