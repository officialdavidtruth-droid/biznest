"use client";

import { useRef, useState, useTransition } from "react";
import { Fingerprint, Copy, Trash2, Upload } from "lucide-react";
import {
  addBiometricDevice, importPunchesCsv, removeBiometricDevice, rotateBiometricDeviceKey, saveHrSettings, type getBiometricSetup,
} from "@/lib/actions/hr-biometrics";

type Setup = Exclude<Awaited<ReturnType<typeof getBiometricSetup>>, { error: string }>;
const input = "rounded-lg border bg-background px-3 py-2 text-sm";
const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never");
const online = (d: Date | string | null) => !!d && Date.now() - new Date(d).getTime() < 10 * 60_000;

export function HrScannersPanel({ slug, setup, onChanged }: { slug: string; setup: Setup; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newKey, setNewKey] = useState<{ serial: string; key: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const done = (text: string) => { setMsg({ ok: true, text }); onChanged(); };
  const fail = (text: string) => setMsg({ ok: false, text });

  return (
    <div className="space-y-4">
      {msg && <p className={`rounded-lg border p-2.5 text-xs ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-red-500/30 bg-red-500/10 text-red-700"}`}>{msg.text}</p>}

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-bold">Working hours</h2>
        <p className="mt-1 text-xs text-muted-foreground">Used to mark clock-ins as on time or late.</p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveHrSettings(slug, String(f.get("shiftStart")), Number(f.get("grace")), f.get("req") === "on");
              r.success ? done("Saved.") : fail(r.error);
            });
          }}
        >
          <label className="text-xs">Shift starts<input name="shiftStart" type="time" defaultValue={setup.settings.shiftStart} className={`${input} mt-1 w-full`} /></label>
          <label className="text-xs">Grace (minutes)<input name="grace" type="number" min={0} max={180} defaultValue={setup.settings.graceMinutes} className={`${input} mt-1 w-full`} /></label>
          <label className="flex items-end gap-2 pb-2 text-xs sm:col-span-2"><input type="checkbox" name="req" defaultChecked={setup.settings.requireBiometric} />Staff must use fingerprint / face on their phone to clock themselves in</label>
          <button disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:col-span-4 sm:w-fit">Save</button>
        </form>
      </section>

      <section className="rounded-xl border p-4">
        <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Fingerprint / face scanners</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Staff enrol on the scanner itself. BizNest never stores fingerprints, only the scan time against the user ID. Give each employee their scanner ID under Employees → Edit.</p>

        <div className="mt-3 space-y-2">
          {setup.devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${online(d.lastSeenAt) ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              <div><span className="font-semibold">{d.name}</span><span className="block text-muted-foreground">Serial {d.serialNumber} · last contact {when(d.lastSeenAt)} · last scan {when(d.lastPunchAt)}</span></div>
              <button disabled={pending} onClick={() => start(async () => { const r = await rotateBiometricDeviceKey(slug, d.id); r.success ? (setNewKey({ serial: d.serialNumber, key: r.data.key }), done("New key created.")) : fail(r.error); })} className="ml-auto rounded border px-2 py-1 text-[10px] font-bold">New key</button>
              <button aria-label="Remove scanner" disabled={pending} onClick={() => window.confirm(`Remove ${d.name}? Past scans are kept.`) && start(async () => { const r = await removeBiometricDevice(slug, d.id); r.success ? done("Removed.") : fail(r.error); })}><Trash2 className="h-4 w-4 text-destructive" /></button>
            </div>
          ))}
          {!setup.devices.length && <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">No scanner added yet. Add one below, or import scans from a file.</p>}
        </div>

        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            start(async () => {
              const r = await addBiometricDevice(slug, String(f.get("name")), String(f.get("serial")));
              if (!r.success) return fail(r.error);
              setNewKey({ serial: String(f.get("serial")).trim(), key: r.data.key }); form.reset(); done("Scanner added.");
            });
          }}
        >
          <input required name="name" placeholder="Name, e.g. Front desk" className={input} />
          <input required name="serial" placeholder="Serial number (on the device label)" className={input} />
          <button disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add scanner</button>
        </form>

        {newKey && (
          <div className="mt-3 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <p className="font-bold">Connect scanner {newKey.serial}</p>
            <p><b>Option 1, direct (ZKTeco and compatible).</b> On the scanner: Menu → Comm. → Cloud Server Setting. Server address <code>biznest.space</code>, port <code>443</code>, turn HTTPS on. When it connects, the dot above turns green. Not every model has HTTPS; if yours doesn't, use Option 2.</p>
            <p><b>Option 2, any scanner (recommended for older models).</b> On a PC at the same site that stays on: install Node.js, <a className="underline" href="/api/hr/bridge">download the bridge</a>, then run it. Set the scanner's server address to that PC's local IP, port 8081.</p>
            <div className="flex items-start gap-2 rounded bg-background p-2 font-mono text-[11px] break-all">
              <span className="flex-1">DEVICE_KEYS=&quot;{newKey.serial}={newKey.key}&quot; node biznest-bridge.mjs</span>
              <button aria-label="Copy" onClick={() => navigator.clipboard?.writeText(`DEVICE_KEYS="${newKey.serial}=${newKey.key}" node biznest-bridge.mjs`)}><Copy className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-muted-foreground">This key is shown once. Keep it private; use &quot;New key&quot; if it leaks.</p>
          </div>
        )}
      </section>

      {setup.unmatched.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs">
          <h2 className="text-sm font-bold">Scans from unknown scanner IDs</h2>
          <p className="mt-1 text-muted-foreground">These people scanned but aren&apos;t linked to an employee yet. Open the employee, Edit, and enter the ID; their past scans are attached automatically.</p>
          <div className="mt-2 flex flex-wrap gap-2">{setup.unmatched.map((u) => <span key={u.deviceUserId} className="rounded-full border px-2 py-1 font-semibold">ID {u.deviceUserId} · {u.scans} scans</span>)}</div>
        </section>
      )}

      <section className="rounded-xl border p-4">
        <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Import scans from a file</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Export attendance from your scanner (USB or its software) as CSV with the user ID and the date and time on each line. Safe to import the same file twice.</p>
        <input ref={file} type="file" accept=".csv,.txt,.dat" className="mt-2 text-xs" />
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const f = file.current?.files?.[0];
            if (!f) return fail("Choose a file first.");
            const r = await importPunchesCsv(slug, await f.text());
            if (!r.success) return fail(r.error);
            done(`Imported ${r.data.stored} scans${r.data.unmatched ? `, ${r.data.unmatched} with unknown IDs` : ""}${r.data.skipped ? `, ${r.data.skipped} lines skipped` : ""}.`);
            if (file.current) file.current.value = "";
          })}
          className="ml-2 rounded-lg border px-3 py-1.5 text-xs font-bold"
        >Import</button>
      </section>
    </div>
  );
}
