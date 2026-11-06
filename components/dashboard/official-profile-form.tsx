"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MultiImageUpload } from "@/components/forms/multi-image-upload";
import { ensureOfficialAccount, updateOfficialProfile } from "@/lib/actions/official";
import { BIO_MAX } from "@/lib/browse";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60";

export function SetupOfficial() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="rounded-xl border bg-background p-6 text-center">
      <h2 className="font-semibold">BizNest has no Browse account yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">This creates a verified BizNest profile on Browse. You post to it from this page, and nobody can sign in as it.</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <button className={`${btn} mt-4`} disabled={pending} onClick={() => start(async () => { const r = await ensureOfficialAccount(); if (!r.success) setError(r.error); else router.refresh(); })}>{pending ? "Creating…" : "Create the BizNest account"}</button>
    </div>
  );
}

export function OfficialProfileForm({ initial }: { initial: { name: string; bio: string; logoUrl: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [logo, setLogo] = useState<string[]>(initial.logoUrl ? [initial.logoUrl] : []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="space-y-3 rounded-xl border bg-background p-4" onSubmit={(e) => {
      e.preventDefault(); setMsg(null);
      start(async () => {
        const r = await updateOfficialProfile({ name, bio, logoUrl: logo[0] ?? null });
        setMsg(r.success ? { ok: true, text: "Profile saved." } : { ok: false, text: r.error });
        if (r.success) router.refresh();
      });
    }}>
      <h2 className="font-semibold">Profile</h2>
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="off-name">Name</label>
        <input id="off-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="off-bio">Bio</label>
        <textarea id="off-bio" className={input} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} />
      </div>
      <div>
        <MultiImageUpload value={logo} onChange={setLogo} max={1} label="Logo" />
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      <button className={btn} disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
