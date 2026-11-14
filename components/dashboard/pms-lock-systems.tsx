"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { connectTtlock, disconnectLockSystem, enableBridge, mapRoomLock, retryRevokeAccess, retryStayAccess, type LockSystemView } from "@/lib/actions/lock-systems";

const box = "rounded-2xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] bg-[var(--bn-admin-surface)]/[0.025] p-5";
const field = "w-full rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] bg-[color-mix(in_srgb,var(--bn-admin-page)_20%,transparent)] px-3 py-2.5 text-xs text-[var(--bn-admin-text)]";
const btn = "rounded-lg border border-[color-mix(in_srgb,var(--bn-admin-border)_20%,transparent)] px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50";

type Lock = { lockId: string; name: string; hasGateway: boolean };

export function PmsLockSystems({ slug, rooms, system }: { slug: string; rooms: { id: string; name: string }[]; system: LockSystemView | null }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ clientId: "", clientSecret: "", username: "", password: "" });
  const [locks, setLocks] = useState<Lock[]>([]);
  const mapped = new Map((system?.roomLocks ?? []).map((l) => [l.roomId, l]));
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => { const r = await fn(); if (r.success) toast.success(ok); else toast.error(r.error || "Something went wrong."); });

  const connected = system?.provider != null;
  return (
    <div className={`${box} space-y-4`}>
      <div>
        <h3 className="text-lg font-semibold">Lock system</h3>
        <p className="mt-1 text-xs text-[var(--bn-admin-text)]">
          Connect the hotel&apos;s smart locks so a guest&apos;s door access starts at check-in and is removed at check-out, with no manual card work.
          <b> TTLock</b> works over the internet (the locks need a WiFi lock or a TTLock gateway). Systems that run on a server inside the hotel, such as <b>ASSA ABLOY Visionline / VingCard</b>, use the on-site agent option.
          Salto KS is not connected yet.
        </p>
      </div>

      {!connected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-4">
            <p className="text-sm font-medium">TTLock</p>
            <p className="text-[11px] text-[var(--bn-admin-text)]">Register an app at the TTLock Open Platform for the developer ID and secret, then use the hotel&apos;s TTLock app account. Only a one-way scrambled form of the password is stored, encrypted.</p>
            <input className={field} placeholder="Developer ID (client ID)" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
            <input className={field} type="password" placeholder="Developer secret" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} />
            <input className={field} placeholder="TTLock app username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className={field} type="password" placeholder="TTLock app password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button disabled={pending} className={btn} onClick={() => start(async () => {
              const r = await connectTtlock(slug, form);
              if (r.success) { setLocks(r.data.locks); setForm({ clientId: "", clientSecret: "", username: "", password: "" }); toast.success(`Connected. ${r.data.locks.length} lock(s) found.`); } else toast.error(r.error);
            })}>Connect TTLock</button>
          </div>
          <div className="space-y-2 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-4">
            <p className="text-sm font-medium">On-site system (Visionline / VingCard and similar)</p>
            <p className="text-[11px] text-[var(--bn-admin-text)]">BizNest cannot reach a lock server inside the hotel. An on-site agent asks BizNest for check-in and check-out jobs and carries them out locally. The agent must be set up with the lock vendor.</p>
            <button disabled={pending} className={btn} onClick={() => run(() => enableBridge(slug), "On-site agent address created.")}>Use an on-site agent</button>
          </div>
        </div>
      )}

      {connected && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p>
              {system?.provider === "TTLOCK" ? <>Connected to TTLock as <b>{system.ttUsername}</b>.</> : <>On-site agent enabled{system?.bridgeLastSeenAt ? <>, last seen {new Date(system.bridgeLastSeenAt).toLocaleString()}</> : <>, not connected yet</>}.</>}
              {system?.lastError && <span className="ml-2 text-[var(--bn-admin-danger)]">Last problem: {system.lastError}</span>}
            </p>
            <button disabled={pending} className={btn} onClick={() => { if (confirm("Disconnect the lock system? Existing guest access will not be removed from the locks.")) run(() => disconnectLockSystem(slug), "Disconnected."); }}>Disconnect</button>
          </div>
          {system?.provider === "BRIDGE" && system.bridgeUrl && (
            <p className="break-all rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-3 font-mono text-[10px]">{system.bridgeUrl}</p>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">Which lock is each room?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {rooms.map((room) => {
                const current = mapped.get(room.id);
                return (
                  <div key={room.id} className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-2">
                    <span className="w-24 shrink-0 truncate text-xs font-medium">{room.name}</span>
                    {system?.provider === "TTLOCK" && locks.length > 0 ? (
                      <select className={field} value={current?.lockId ?? ""} onChange={(e) => run(() => mapRoomLock(slug, room.id, e.target.value, locks.find((l) => l.lockId === e.target.value)?.name), "Saved.")}>
                        <option value="">No lock</option>
                        {locks.map((l) => <option key={l.lockId} value={l.lockId}>{l.name}{l.hasGateway ? "" : " (no gateway)"}</option>)}
                      </select>
                    ) : (
                      <input className={field} defaultValue={current?.lockId ?? ""} placeholder={system?.provider === "TTLOCK" ? "TTLock lock ID" : "Door / room code in the lock system"} onBlur={(e) => { if (e.target.value.trim() !== (current?.lockId ?? "")) run(() => mapRoomLock(slug, room.id, e.target.value), "Saved."); }} />
                    )}
                  </div>
                );
              })}
            </div>
            {system?.provider === "TTLOCK" && locks.length === 0 && <p className="mt-2 text-[11px] text-[var(--bn-admin-text)]">Lock names load when you connect. To pick from the list again, disconnect and reconnect, or type the TTLock lock ID.</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Guest door access</p>
            {(system?.grants.length ?? 0) === 0 && <p className="text-xs text-[var(--bn-admin-text)]">Nothing issued yet. Access is created automatically when a guest is checked in to a room that has a lock.</p>}
            <ul className="space-y-2">
              {system?.grants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-3 text-xs">
                  <span>
                    <b>{g.roomName}</b> · {g.guestName} · until {new Date(g.endsAt).toLocaleString()}
                    {g.passcode && g.status === "ACTIVE" && <> · Passcode <span className="font-mono text-sm font-semibold">{g.passcode}</span></>}
                    <span className="ml-2 opacity-70">{g.status === "ACTIVE" ? "Active" : g.status === "PENDING" ? "Waiting for the lock system" : g.status === "REVOKE_PENDING" ? "Removal pending" : "Failed"}</span>
                    {g.error && <span className="ml-2 text-[var(--bn-admin-danger)]">{g.error}</span>}
                  </span>
                  <span className="flex gap-2">
                    {g.status === "FAILED" && <button disabled={pending} className={btn} onClick={() => run(() => retryStayAccess(slug, g.reservationId), "Access issued.")}>Try again</button>}
                    {g.status === "REVOKE_PENDING" && <button disabled={pending} className={btn} onClick={() => run(() => retryRevokeAccess(slug, g.reservationId), "Access removed.")}>Retry removal</button>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
