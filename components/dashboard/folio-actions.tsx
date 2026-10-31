"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { settleFolio, voidFolioCharge } from "@/lib/actions/folio";

export function VoidChargeButton({ storeSlug, chargeId }: { storeSlug: string; chargeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!window.confirm("Void this charge? It will be removed from the guest's room bill.")) return;
    setBusy(true);
    const result = await voidFolioCharge(storeSlug, chargeId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Charge voided.");
    router.refresh();
  }
  return (
    <button type="button" disabled={busy} onClick={run} className="text-xs font-medium text-destructive hover:underline disabled:opacity-50">
      Void
    </button>
  );
}

export function SettleFolioButton({ storeSlug, reservationId }: { storeSlug: string; reservationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    const method = window.prompt("How did the guest pay? (e.g. cash, card, transfer) — optional");
    if (method === null) return;
    setBusy(true);
    const result = await settleFolio(storeSlug, reservationId, method);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Room bill marked as paid.");
    router.refresh();
  }
  return (
    <button type="button" disabled={busy} onClick={run} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
      {busy ? "Saving…" : "Mark room bill paid"}
    </button>
  );
}
