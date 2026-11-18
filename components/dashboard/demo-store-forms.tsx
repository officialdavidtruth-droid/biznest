"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUpDemoStore, switchDemoNiche } from "@/lib/actions/demo-store";
import { DEMO_PASSWORD_MIN } from "@/lib/demo-store";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60";

function generatePassword(): string {
  // No look-alike characters (0/O, 1/l/I) so it can be read off a screen and typed on a phone.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

/** SupaAdmin: create the demo store's login, or reset its password. */
export function DemoStoreSetupForm({ isSetUp, email }: { isSetUp: boolean; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState(() => generatePassword());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="space-y-3 rounded-xl border bg-background p-4" onSubmit={(e) => {
      e.preventDefault(); setMsg(null);
      start(async () => {
        const r = await setUpDemoStore(password);
        setMsg(r.success ? { ok: true, text: `Done. Sign in at /login with ${r.data.email} and the password shown here. Copy it now; it is not stored anywhere you can read it back.` } : { ok: false, text: r.error });
        if (r.success) router.refresh();
      });
    }}>
      <h2 className="font-semibold">{isSetUp ? "Reset the demo password" : "Create the demo store"}</h2>
      <p className="text-sm text-muted-foreground">Login email: <b>{email}</b></p>
      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="demo-pw">Password (at least {DEMO_PASSWORD_MIN} characters)</label>
        <div className="flex gap-2">
          <input id="demo-pw" className={`${input} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} />
          <button type="button" className="rounded-lg border px-3 text-sm" onClick={() => setPassword(generatePassword())}>New</button>
        </div>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
      <button className={btn} disabled={pending}>{pending ? "Working…" : isSetUp ? "Set this password" : "Create demo store"}</button>
    </form>
  );
}

/** Store Settings (demo store only): switch the whole store to another business niche. */
export function DemoNicheSwitcher({ slug, current, niches }: { slug: string; current: string; niches: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">Demo niche</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Switch this demo store to another type of business. Its menu, categories, sample products or services and homepage change to match. Anything you added by hand in the current niche is cleared.
      </p>
      <div className="flex gap-2">
        <select aria-label="Demo niche" className={input} value={value} onChange={(e) => setValue(e.target.value)} disabled={pending}>
          {niches.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          type="button"
          className={btn}
          disabled={pending || value === current}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const r = await switchDemoNiche(slug, value);
              setMsg(r.success ? { ok: true, text: `Switched to ${r.data.niche}.` } : { ok: false, text: r.error });
              if (r.success) router.refresh();
            });
          }}
        >
          {pending ? "Switching…" : "Switch"}
        </button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
