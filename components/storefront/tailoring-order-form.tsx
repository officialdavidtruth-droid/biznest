"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { submitTailoringRequest } from "@/lib/actions/tailoring-public";

type Colors = { accent: string; onAccent: string; ink: string };

/** Storefront order form for made-to-measure work. Sends a request to the tailor; nothing is charged. */
export function TailoringOrderForm({ slug, storeName, colors }: { slug: string; storeName: string; colors: Colors }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const field = { border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit", borderRadius: 12, padding: "12px 14px", fontSize: 15, width: "100%" } as const;
  const label = { fontSize: 13, fontWeight: 600, display: "grid", gap: 6 } as const;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        const body = new FormData(); body.append("file", file);
        const res = await fetch(`/api/store/${slug}/tailoring-upload`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) { setError(data.error || "That photo couldn't be uploaded."); break; }
        setPhotos((p) => (p.length < 4 ? [...p, data.url] : p));
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("photos", JSON.stringify(photos));
    start(async () => {
      const r = await submitTailoringRequest(slug, fd);
      if (!r.success) { setError(r.error); return; }
      setError(""); setDone(true);
    });
  };

  if (done) {
    return (
      <div role="status" style={{ border: `1px solid ${colors.ink}22`, borderRadius: 16, padding: 24 }}>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Request sent</p>
        <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>Thank you. {storeName} will contact you on the phone number you gave to confirm measurements, the price and a delivery date.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={label}>Your name<input required name="customerName" maxLength={80} autoComplete="name" style={field} /></label>
        <label style={label}>Phone (WhatsApp if you can)<input required name="customerPhone" type="tel" maxLength={30} autoComplete="tel" style={field} /></label>
      </div>
      <label style={label}>Email (optional)<input name="customerEmail" type="email" maxLength={120} autoComplete="email" style={field} /></label>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={label}>What would you like made?<input required name="garmentType" maxLength={80} placeholder="e.g. Agbada, 2-piece suit, wedding gown" style={field} /></label>
        <label style={label}>Needed by (optional)<input name="neededBy" type="date" style={field} /></label>
      </div>
      <label style={label}>Style, fabric and fit notes<textarea name="details" rows={4} maxLength={2000} placeholder="Colour, fabric, how you want it to look, the occasion…" style={{ ...field, resize: "vertical" }} /></label>

      <div style={label}>
        <span>Reference photos (optional, up to 4)</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {photos.map((u) => (
            <span key={u} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Reference" width={72} height={72} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }} />
              <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== u))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: "none", background: colors.ink, color: "#fff", fontSize: 12, lineHeight: "20px", cursor: "pointer" }}>×</button>
            </span>
          ))}
          {photos.length < 4 && (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} style={{ ...field, width: "auto", cursor: "pointer", fontWeight: 600 }}>{uploading ? "Uploading…" : "Add photo"}</button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void upload(e.target.files)} />
        </div>
      </div>

      {error && <p role="alert" style={{ fontSize: 14, color: "#b91c1c" }}>{error}</p>}
      <button disabled={pending || uploading} style={{ background: colors.accent, color: colors.onAccent, border: "none", borderRadius: 999, padding: "14px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: pending || uploading ? 0.7 : 1 }}>
        {pending ? "Sending…" : "Send request"}
      </button>
      <p style={{ fontSize: 12, opacity: 0.65 }}>This is a request, not a payment. {storeName} will confirm the price with you before any work starts.</p>
    </form>
  );
}
