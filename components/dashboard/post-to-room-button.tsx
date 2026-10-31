"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { postBillToRoom, type InHouseReservation } from "@/lib/actions/folio";

/**
 * Hotel stores: charge a bill or POS order to a checked-in guest's room instead of taking payment
 * now. Renders nothing when no guest is checked in (so non-hotel stores never see it).
 */
export function PostToRoomButton({
  storeSlug,
  kind,
  id,
  rooms,
  postedTo,
  className = "text-primary hover:underline",
}: {
  storeSlug: string;
  kind: "invoice" | "order";
  id: string;
  rooms: InHouseReservation[];
  postedTo?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reservationId, setReservationId] = useState("");
  const [busy, setBusy] = useState(false);

  if (postedTo) return <span className="text-xs font-medium text-muted-foreground">On room {postedTo}</span>;
  if (rooms.length === 0) return null;

  async function submit() {
    if (!reservationId) {
      toast.error("Choose a room first.");
      return;
    }
    setBusy(true);
    const result = await postBillToRoom(storeSlug, { kind, id, reservationId });
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Posted to room ${result.data.roomName}.`);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Post to room
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
        <option value="">Choose room…</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            Room {r.roomName} · {r.guestName}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy} onClick={submit} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? "Posting…" : "Post"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">
        Cancel
      </button>
    </span>
  );
}
