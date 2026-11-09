"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveReferralWithdrawal, rejectReferralWithdrawal, cancelReferralReward, saveReferralConfig } from "@/lib/actions/vendor-referral-admin";

const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

export function WithdrawalReviewButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function approve() {
    if (!window.confirm("Approve this withdrawal and send the money now?")) return;
    setBusy(true);
    const r = await approveReferralWithdrawal(id);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Approved. The transfer is on its way.");
    router.refresh();
  }
  async function reject() {
    const reason = window.prompt("Why are you declining this? The money goes back to the vendor's wallet.", "");
    if (reason === null) return;
    setBusy(true);
    const r = await rejectReferralWithdrawal(id, reason);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Declined. The money is back in the wallet.");
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <button onClick={approve} disabled={busy} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Approve</button>
      <button onClick={reject} disabled={busy} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Decline</button>
    </div>
  );
}

export function CancelRewardButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    const reason = window.prompt("Reason for cancelling this reward (shown only to you):", "");
    if (reason === null) return;
    setBusy(true);
    const r = await cancelReferralReward(id, reason);
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Reward cancelled.");
    router.refresh();
  }
  return (
    <button onClick={go} disabled={busy} className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
      Cancel reward
    </button>
  );
}

type PlanRow = { id: string; name: string; price: number; reward: number; unlockCount: number };

export function ReferralConfigForm({ initial, plans }: { initial: { enabled: boolean; holdDays: number; reviewAbove: number }; plans: PlanRow[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [holdDays, setHoldDays] = useState(String(initial.holdDays));
  const [reviewAbove, setReviewAbove] = useState(String(initial.reviewAbove));
  const [rows, setRows] = useState(plans.map((p) => ({ ...p, reward: String(p.reward), unlockCount: String(p.unlockCount) })));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await saveReferralConfig({
      enabled,
      holdDays: Number(holdDays),
      reviewAbove: Number(reviewAbove),
      plans: Object.fromEntries(rows.map((p) => [p.id, { reward: Number(p.reward), unlockCount: Number(p.unlockCount) }])),
    });
    setSaving(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Referral settings saved. They apply to new paying referrals only.");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Program settings</h2>
        <button onClick={() => setEnabled((v) => !v)} className={`h-5 w-9 rounded-full transition ${enabled ? "bg-primary" : "bg-muted"}`} aria-label="Program on or off">
          <span className={`block h-4 w-4 rounded-full bg-background transition ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Days a reward is held after payment
          <input className={`${field} mt-1`} type="number" min={0} max={60} value={holdDays} onChange={(e) => setHoldDays(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">
          Withdrawals above this amount (₦) need your approval
          <input className={`${field} mt-1`} type="number" min={0} value={reviewAbove} onChange={(e) => setReviewAbove(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Reward and referrals needed, per plan the referred person pays for:</p>
        {rows.map((p, i) => (
          <div key={p.id} className="space-y-1">
            <div className="text-sm font-medium">{p.name} <span className="text-xs text-muted-foreground">(₦{p.price.toLocaleString()})</span></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Reward ₦
                <input className={`${field} mt-1`} type="number" min={0} value={p.reward} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, reward: e.target.value } : x)))} />
              </label>
              <label className="text-xs text-muted-foreground">
                Referrals needed
                <input className={`${field} mt-1`} type="number" min={1} value={p.unlockCount} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, unlockCount: e.target.value } : x)))} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
