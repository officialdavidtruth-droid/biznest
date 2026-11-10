"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendAtRiskNudge, sendAtRiskNudgeAll } from "@/lib/actions/churn-admin";

export function NudgeButton({ storeId, name }: { storeId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await sendAtRiskNudge(storeId);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success(`Reminder sent to ${name}.`);
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy} className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
      {busy ? "Sending…" : "Send reminder"}
    </button>
  );
}

export function NudgeAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm(`Send a reminder to all ${count} at-risk stores now? Each owner gets a phone notification and a pop-up on their dashboard.`)) return;
    setBusy(true);
    const r = await sendAtRiskNudgeAll();
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success(`Reminders sent to ${r.data.sent} stores.`);
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy || count === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
      {busy ? "Sending…" : `Remind all (${count})`}
    </button>
  );
}
