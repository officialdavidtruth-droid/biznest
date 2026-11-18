"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Clock, Fingerprint, FileText, LogIn, LogOut, Trash2 } from "lucide-react";
import { clockSelf, removeMyCredential, type getMyWork } from "@/lib/actions/hr-biometrics";
import { formatMoney } from "@/lib/utils/format-money";

type Data = Exclude<Awaited<ReturnType<typeof getMyWork>>, { error: string }>;

const time = (d: Date | string | null, tz: string) => (d ? new Date(d).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "—");
const day = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function webauthn(slug: string, step: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/hr/webauthn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, step, ...extra }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}

export function MyWork({ slug, data }: { slug: string; data: Data }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const clockedIn = !!data.today?.checkIn;
  const clockedOut = !!data.today?.checkOut;
  const supported = typeof window === "undefined" ? true : browserSupportsWebAuthn();

  const note = (ok: boolean, text: string) => setMsg({ ok, text });

  const plainClock = () => start(async () => {
    const r = await clockSelf(slug);
    if (!r.success) return note(false, r.error);
    note(true, clockedIn ? "Clocked out. See you tomorrow." : "Clocked in. Have a good day.");
    router.refresh();
  });

  const biometricClock = async () => {
    setBusy(true);
    try {
      const options = await webauthn(slug, "login-options");
      const response = await startAuthentication({ optionsJSON: options });
      await webauthn(slug, "login-verify", { response });
      note(true, clockedIn ? "Verified. Clock-out recorded." : "Verified. Clock-in recorded.");
      router.refresh();
    } catch (e) {
      note(false, e instanceof Error ? e.message : "Biometric check failed.");
    } finally { setBusy(false); }
  };

  const registerBiometric = async () => {
    setBusy(true);
    try {
      const options = await webauthn(slug, "register-options");
      const response = await startRegistration({ optionsJSON: options });
      await webauthn(slug, "register-verify", { response, label: navigator.platform || "This device" });
      note(true, "Fingerprint / face set up on this device. You can now clock in with it.");
      router.refresh();
    } catch (e) {
      note(false, e instanceof Error ? e.message : "Couldn't set up this device.");
    } finally { setBusy(false); }
  };

  const hasBiometric = data.credentials.length > 0;
  const btn = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60";

  return (
    <div className="bn-admin-page max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My work</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hi {data.name}. Clock in and out, and get your payslips.</p>
      </div>

      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-red-500/30 bg-red-500/10 text-red-700"}`}>{msg.text}</p>}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Today</h2></div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border p-2"><span className="text-muted-foreground">In</span><p className="mt-1 text-sm font-bold">{time(data.today?.checkIn ?? null, data.timeZone)}</p></div>
          <div className="rounded-lg border p-2"><span className="text-muted-foreground">Out</span><p className="mt-1 text-sm font-bold">{time(data.today?.checkOut ?? null, data.timeZone)}</p></div>
          <div className="rounded-lg border p-2"><span className="text-muted-foreground">Status</span><p className="mt-1 text-sm font-bold">{data.today ? data.today.status.replace("_", " ") : "Not in"}</p></div>
        </div>

        {hasBiometric && supported && (
          <button onClick={biometricClock} disabled={busy} className={`${btn} bg-primary text-primary-foreground`}>
            <Fingerprint className="h-5 w-5" /> {busy ? "Checking…" : clockedIn && !clockedOut ? "Clock out with fingerprint / face" : clockedIn ? "Update clock-out with fingerprint / face" : "Clock in with fingerprint / face"}
          </button>
        )}
        {!data.requireBiometric && (
          <button onClick={plainClock} disabled={pending} className={`${btn} ${hasBiometric ? "border" : "bg-primary text-primary-foreground"}`}>
            {clockedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />} {pending ? "Saving…" : clockedIn ? "Clock out" : "Clock in"}
          </button>
        )}
        {data.requireBiometric && !hasBiometric && <p className="text-xs text-muted-foreground">Your employer requires fingerprint or face to clock in. Set it up below on your phone.</p>}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Fingerprint / face on this phone</h2></div>
        <p className="text-xs text-muted-foreground">Uses the same fingerprint or face unlock you use to open your phone. Nothing biometric is sent to BizNest, only a secure key.</p>
        {supported ? (
          <button onClick={registerBiometric} disabled={busy} className={`${btn} border`}>{hasBiometric ? "Add another device" : "Set up on this device"}</button>
        ) : <p className="text-xs text-red-600">This browser doesn't support fingerprint or face sign-in. Try Chrome or Safari on your phone.</p>}
        {data.credentials.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
            <span>{c.label || "Device"} · added {day(c.createdAt)}</span>
            <button aria-label="Remove device" onClick={() => start(async () => { const r = await removeMyCredential(slug, c.id); if (r.success) router.refresh(); else note(false, r.error); })}><Trash2 className="h-4 w-4 text-destructive" /></button>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">My payslips</h2></div>
        {data.payslips.length === 0 && <p className="text-xs text-muted-foreground">Payslips appear here once payroll for a month is approved.</p>}
        {data.payslips.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
            <div><span className="font-semibold">{day(p.periodStart)} – {day(p.periodEnd)}</span><span className="block text-muted-foreground">Net {formatMoney(p.net)} · {p.status === "PAID" ? "Paid" : "Approved"}</span></div>
            <a href={`/api/hr/payslip/${p.id}?inline=1`} target="_blank" rel="noreferrer" className="ml-auto rounded border px-2 py-1 font-semibold">View</a>
            <a href={`/api/hr/payslip/${p.id}`} className="rounded bg-primary px-2 py-1 font-semibold text-primary-foreground">PDF</a>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold">Recent days</h2>
        {data.recent.length === 0 && <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>}
        {data.recent.map((r) => (
          <div key={String(r.workDate)} className="flex items-center justify-between text-xs"><span>{day(r.workDate)}</span><span className="text-muted-foreground">{time(r.checkIn, data.timeZone)} – {time(r.checkOut, data.timeZone)} · {r.status.replace("_", " ")}</span></div>
        ))}
      </section>
    </div>
  );
}
