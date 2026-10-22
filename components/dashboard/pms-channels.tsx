"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import {
  createChannelConnection,
  deleteChannelConnection,
  requestChannelManager,
  setChannelActive,
  syncChannelNow,
  type ChannelConnectionView,
  type ChannelManagerRequestView,
} from "@/lib/actions/channels";

const PROVIDERS: Array<[string, string]> = [
  ["BOOKING_COM", "Booking.com"],
  ["AIRBNB", "Airbnb"],
  ["EXPEDIA", "Expedia"],
  ["VRBO", "Vrbo"],
  ["AGODA", "Agoda"],
  ["TRIPADVISOR", "Tripadvisor"],
  ["OTHER", "Other channel"],
];

const card = "rounded-2xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] bg-[var(--bn-admin-surface)]/[0.025] p-5";
const input = "w-full rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_15%,transparent)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--bn-admin-orange)]";
const btn = "inline-flex items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_15%,transparent)] px-3 py-1.5 text-xs transition hover:bg-[var(--bn-admin-surface)]/[0.06] disabled:opacity-50";

function when(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success("Link copied"), () => toast.error("Could not copy"));
}

export function PmsChannels({
  slug,
  rooms,
  connections,
  requests,
}: {
  slug: string;
  rooms: Array<{ id: string; name: string }>;
  connections: ChannelConnectionView[];
  requests: ChannelManagerRequestView[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [provider, setProvider] = useState("BOOKING_COM");
  const [importUrl, setImportUrl] = useState("");
  const [label, setLabel] = useState("");
  const [rtCode, setRtCode] = useState("");
  const [rtEmail, setRtEmail] = useState("");

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.success) toast.error(res.error ?? "Something went wrong.");
      else { toast.success(ok); after?.(); }
      router.refresh();
    });
  }

  const hasRateTigerRequest = requests.some((r) => r.provider === "RATETIGER" && ["REQUESTED", "IN_PROGRESS"].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Channels &amp; OTAs</h2>
        <p className="mt-1 text-sm text-white">Keep availability in step with Booking.com, Airbnb, Expedia and other channels so a room sold anywhere is blocked everywhere.</p>
      </div>

      <section className={card}>
        <h3 className="text-sm font-semibold">Connect a channel calendar</h3>
        <p className="mt-1 text-xs text-white">Per room: paste the channel&apos;s calendar (iCal) link to pull its bookings into BizNest, then give the channel the BizNest link we create so it sees your bookings. Leave the link empty to start with export only.</p>
        {rooms.length === 0 ? (
          <p className="mt-3 text-sm text-white">Add a room first under Rooms.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs">Room
              <select className={`${input} mt-1`} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                {rooms.map((r) => <option key={r.id} value={r.id} className="text-black">{r.name}</option>)}
              </select>
            </label>
            <label className="block text-xs">Channel
              <select className={`${input} mt-1`} value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDERS.map(([k, v]) => <option key={k} value={k} className="text-black">{v}</option>)}
              </select>
            </label>
            <label className="block text-xs md:col-span-2">Channel calendar link (iCal, optional)
              <input className={`${input} mt-1`} placeholder="https://… or webcal://…" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
            </label>
            <label className="block text-xs md:col-span-2">Note (optional)
              <input className={`${input} mt-1`} placeholder="e.g. Deluxe King listing" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </label>
            <div className="md:col-span-2">
              <button
                disabled={pending || !roomId}
                className={`${btn} bg-[var(--bn-admin-orange)] text-black`}
                onClick={() => start(async () => {
                  const res = await createChannelConnection(slug, { roomId, provider, importUrl, label });
                  if (!res.success) toast.error(res.error);
                  else if (res.data.sync && !res.data.sync.ok) toast.error(`Connected, but the first sync failed: ${res.data.sync.error}`);
                  else toast.success(res.data.sync ? `Connected. ${res.data.sync.blocks} booking(s) imported.` : "Connected. Give the channel your BizNest calendar link below.");
                  if (res.success) { setImportUrl(""); setLabel(""); }
                  router.refresh();
                })}
              ><Link2 className="h-3.5 w-3.5" /> Connect</button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Connected channels ({connections.length})</h3>
        {connections.length === 0 && <div className={`${card} text-sm text-white`}>No channels connected yet.</div>}
        {connections.map((c) => {
          const ok = c.lastSyncStatus === "OK";
          const failed = c.lastSyncStatus === "ERROR";
          return (
            <div key={c.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{c.roomName} <span className="font-normal text-white">· {c.providerLabel}</span>{c.label ? <span className="font-normal text-white"> · {c.label}</span> : null}</p>
                  <p className="mt-1 text-xs">
                    {!c.isActive ? <span className="text-white">Paused</span>
                      : !c.importUrl ? <span className="text-white">Export only (no channel calendar link)</span>
                      : ok ? <span className="text-emerald-400">Synced {when(c.lastSyncAt)} · {c.blockCount} channel booking(s)</span>
                      : failed ? <span className="text-red-400">Sync problem: {c.lastSyncMessage}</span>
                      : <span className="text-white">Waiting for first sync</span>}
                  </p>
                  {ok && c.lastSyncMessage && <p className="mt-1 text-xs text-amber-400">{c.lastSyncMessage}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.importUrl && <button disabled={pending || !c.isActive} className={btn} onClick={() => run(() => syncChannelNow(slug, c.id), "Synced")}><RefreshCw className="h-3.5 w-3.5" /> Sync now</button>}
                  <button disabled={pending} className={btn} onClick={() => run(() => setChannelActive(slug, c.id, !c.isActive), c.isActive ? "Paused" : "Resumed")}>{c.isActive ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}</button>
                  <button disabled={pending} className={btn} onClick={() => { if (confirm("Remove this channel connection? Its imported bookings will be unblocked.")) run(() => deleteChannelConnection(slug, c.id), "Removed"); }}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--bn-admin-surface)]/[0.04] px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-[11px]">{c.exportUrl}</code>
                <button className={btn} onClick={() => copy(c.exportUrl)}><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
              <p className="mt-1.5 text-[11px] text-white">Paste this BizNest link into {c.providerLabel} as the calendar to import for this room. It shows dates only, never guest details.</p>
            </div>
          );
        })}
        <p className="text-xs text-white">Calendars refresh daily automatically and instantly when you press Sync now. Channels fetch your BizNest link on their own schedule (often every few hours), so overlapping sales are possible inside that window; for tight inventory, sync often.</p>
      </section>

      <section className={card}>
        <h3 className="text-sm font-semibold">Channel manager (RateTiger)</h3>
        <p className="mt-1 text-xs text-white">Real-time rate, availability and reservation sync through a channel manager such as RateTiger runs over a certified two-way connection with the provider, which BizNest has to complete with them. Register your interest and your property details; we&apos;ll contact you when your connection can be set up. Calendar sync above works today.</p>
        {requests.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {requests.map((r) => <li key={r.id} className="flex justify-between rounded-lg bg-[var(--bn-admin-surface)]/[0.04] px-3 py-2"><span>{r.provider === "RATETIGER" ? "RateTiger" : "Other channel manager"}{r.propertyCode ? ` · ${r.propertyCode}` : ""}</span><span className="text-white">{r.status.replace("_", " ")} · {when(r.createdAt)}</span></li>)}
          </ul>
        )}
        {!hasRateTigerRequest && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-xs">RateTiger property / hotel code
              <input className={`${input} mt-1`} value={rtCode} onChange={(e) => setRtCode(e.target.value)} maxLength={80} />
            </label>
            <label className="block text-xs">Contact email
              <input className={`${input} mt-1`} type="email" value={rtEmail} onChange={(e) => setRtEmail(e.target.value)} />
            </label>
            <div className="md:col-span-2">
              <button disabled={pending || !rtEmail} className={btn} onClick={() => run(() => requestChannelManager(slug, { provider: "RATETIGER", propertyCode: rtCode, contactEmail: rtEmail }), "Request sent", () => { setRtCode(""); setRtEmail(""); })}>Request RateTiger connection</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
