"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDoorReader, deleteDoorReader, rotateDoorReader, type DoorReaderView } from "@/lib/actions/door-readers";

const box = "rounded-2xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] bg-[var(--bn-admin-surface)]/[0.025] p-5";
const field = "w-full rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] bg-[color-mix(in_srgb,var(--bn-admin-page)_20%,transparent)] px-3 py-2.5 text-xs text-[var(--bn-admin-text)]";

export function PmsDoorReaders({ slug, rooms, readers }: { slug: string; rooms: { id: string; name: string }[]; readers: DoorReaderView[] }) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.success) toast.error(res.error || "Something went wrong.");
      else toast.success(ok);
    });

  return (
    <div className={`${box} space-y-4`}>
      <div>
        <h3 className="text-lg font-semibold">Door readers</h3>
        <p className="mt-1 text-xs text-[var(--bn-admin-text)]">
          A card only opens a door once a reader asks BizNest. Add a reader for each door, then set the lock controller to call its web address with the scanned card number
          (<span className="font-mono">POST {"{ \"cardUid\": \"...\" }"}</span>) and open the lock only when the reply says <span className="font-mono">allow: true</span>.
          A reader tied to a room opens only that room; a reader with no room (main door, gym) opens for any active card.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reader name, e.g. Room 201 door" className={field} />
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={field}>
          <option value="">Shared door (any active card)</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button
          disabled={pending}
          onClick={() => run(async () => { const r = await createDoorReader(slug, { name, roomId: roomId || undefined }); if (r.success) { setName(""); setRoomId(""); } return r; }, "Door reader added.")}
          className="rounded-xl bg-[var(--bn-admin-surface-2)] px-4 py-2.5 text-xs font-semibold text-[var(--bn-admin-text)] disabled:opacity-50"
        >Add reader</button>
      </div>
      {readers.length === 0 && <p className="text-xs text-[var(--bn-admin-text)]">No door readers yet.</p>}
      <div className="space-y-3">
        {readers.map((r) => (
          <div key={r.id} className="rounded-xl border border-[color-mix(in_srgb,var(--bn-admin-border)_10%,transparent)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{r.name} <span className="text-[11px] text-[var(--bn-admin-text)]">· {r.roomName ?? "Shared door"} · {r.lastSeenAt ? `last seen ${new Date(r.lastSeenAt).toLocaleString()}` : "never connected"}</span></p>
              <div className="flex gap-2">
                <button onClick={() => { void navigator.clipboard.writeText(r.url); toast.success("Address copied."); }} className="rounded-lg border border-[color-mix(in_srgb,var(--bn-admin-border)_20%,transparent)] px-2.5 py-1.5 text-[11px] font-semibold">Copy address</button>
                <button disabled={pending} onClick={() => { if (confirm("Replace this reader's address? The controller must be updated with the new one.")) run(() => rotateDoorReader(slug, r.id), "New address created."); }} className="rounded-lg border border-[color-mix(in_srgb,var(--bn-admin-border)_20%,transparent)] px-2.5 py-1.5 text-[11px] font-semibold">Replace address</button>
                <button disabled={pending} onClick={() => { if (confirm("Remove this door reader?")) run(() => deleteDoorReader(slug, r.id), "Door reader removed."); }} className="rounded-lg border border-[color-mix(in_srgb,var(--bn-admin-danger-line)_20%,transparent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--bn-admin-danger)]">Remove</button>
              </div>
            </div>
            <p className="mt-2 break-all font-mono text-[10px] text-[var(--bn-admin-text)]">{r.url}</p>
            {r.scans.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px]">
                {r.scans.map((s) => (
                  <li key={s.id} className={s.allowed ? "text-emerald-500" : "text-[var(--bn-admin-danger)]"}>
                    {new Date(s.at).toLocaleString()} · <span className="font-mono">{s.cardUid}</span> · {s.allowed ? "Opened" : `Refused: ${s.reason}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
