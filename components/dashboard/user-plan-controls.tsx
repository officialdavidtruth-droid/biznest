"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeUserPlan, grantUserTrial, endUserTrial, forceLogoutUser, deleteUser, forceDeleteUserAndBusiness, banUser, unbanUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import { Ban, LogOut, Trash2, Clock, RefreshCw } from "lucide-react";
import type { Subscription } from "@prisma/client";

type StoreInfo = {
  id: string;
  subscriptionId: string | null;
  trialEndsAt: Date | null;
  subscription: { id: string; name: string } | null;
} | null;

// Inline plan dropdown — upgrades/downgrades a user's store to a different
// plan. Disabled (with an explanatory title) when the user has no store yet,
// since there's nothing to attach a plan to.
export function UserPlanSelect({ userId, store, plans }: { userId: string; store: StoreInfo; plans: Subscription[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (!store) {
    return (
      <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
        No store yet
      </span>
    );
  }

  async function handleChange(planId: string) {
    if (planId === store!.subscriptionId) return;
    setSubmitting(true);
    const result = await changeUserPlan(userId, planId);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Plan updated");
    router.refresh();
  }

  return (
    <select
      defaultValue={store.subscriptionId ?? ""}
      disabled={submitting}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none disabled:opacity-50"
      style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--primary))", color: "hsl(var(--foreground))" }}
    >
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

// Small trial badge + one-click grant/end control, shown next to the plan
// dropdown rather than folded into it — a trial is a time-limited state on
// top of whatever plan is selected, not a plan itself.
export function UserTrialControl({ userId, store, plans }: { userId: string; store: StoreInfo; plans: Subscription[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (!store) return null;

  const isTrialing = !!store.trialEndsAt && new Date(store.trialEndsAt) > new Date();

  async function grant() {
    const days = Number(prompt("Trial length in days:", "14"));
    if (!days) return;
    const planId = store!.subscriptionId ?? plans[plans.length - 1]?.id;
    if (!planId) {
      toast.error("Create a plan first, under Subscriptions.");
      return;
    }
    setSubmitting(true);
    const result = await grantUserTrial(userId, planId, days);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Trial granted for ${days} days`);
    router.refresh();
  }

  async function end() {
    setSubmitting(true);
    const result = await endUserTrial(userId);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Trial ended");
    router.refresh();
  }

  if (isTrialing) {
    return (
      <button
        onClick={end}
        disabled={submitting}
        title={`Trial ends ${new Date(store.trialEndsAt!).toLocaleDateString()} — click to end early`}
        className="mt-1 flex items-center gap-1 text-[10px] font-semibold disabled:opacity-50"
        style={{ color: "hsl(var(--primary))" }}
      >
        <Clock size={10} />
        Trial → {new Date(store.trialEndsAt!).toLocaleDateString()}
      </button>
    );
  }

  return (
    <button
      onClick={grant}
      disabled={submitting}
      className="mt-1 flex items-center gap-1 text-[10px] font-medium disabled:opacity-50"
      style={{ color: "hsl(var(--muted-foreground))" }}
    >
      <Clock size={10} />
      Give free trial
    </button>
  );
}

export function UserActionButtons({ userId, email, isBanned, businessName }: { userId: string; email: string; isBanned: boolean; businessName: string | null }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    setLoadingKey(key);
    const result = await fn();
    setLoadingKey(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(successMsg);
    router.refresh();
  }

  function handleBan() {
    if (isBanned) {
      if (!confirm(`Unban ${email}?`)) return;
      run("ban", () => unbanUser(userId), "User unbanned");
      return;
    }
    const reason = prompt("Reason for banning this user (shown in audit log):");
    if (reason === null) return; // cancelled
    run("ban", () => banUser(userId, reason), "User banned");
  }

  // Users who own a business can't be hard-deleted normally (it would orphan
  // their orders/payments/invoices). If that's why deleteUser() failed, offer
  // the explicit force-teardown path instead of just showing the error.
  async function handleDelete() {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;

    setLoadingKey("delete");
    const result = await deleteUser(userId);
    setLoadingKey(null);

    if (result.success) {
      toast.success("User deleted");
      router.refresh();
      return;
    }

    if (!businessName) {
      toast.error(result.error);
      return;
    }

    const typed = prompt(
      `${email} owns "${businessName}". Deleting will permanently erase this business, its store, products, orders, payments, and invoices — this cannot be undone.\n\nType the business name exactly to confirm:`
    );
    if (typed === null) return; // cancelled
    if (typed.trim() !== businessName) {
      toast.error("Business name didn't match. Nothing was deleted.");
      return;
    }

    run(
      "delete",
      () => forceDeleteUserAndBusiness(userId, typed),
      "User, business, and all store data permanently deleted"
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={handleBan}
        disabled={loadingKey !== null}
        title={isBanned ? "Unban" : "Ban"}
        className="rounded-lg p-1.5 disabled:opacity-50"
        style={{ background: "hsl(38 92% 50% / 0.15)", color: "hsl(38 92% 40%)" }}
      >
        {loadingKey === "ban" ? <RefreshCw size={13} className="animate-spin" /> : <Ban size={13} />}
      </button>
      <button
        onClick={() => {
          if (!confirm(`Force-log-out ${email} on all devices?`)) return;
          run("logout", () => forceLogoutUser(userId), "User logged out everywhere");
        }}
        disabled={loadingKey !== null}
        title="Force logout"
        className="rounded-lg p-1.5 disabled:opacity-50"
        style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
      >
        {loadingKey === "logout" ? <RefreshCw size={13} className="animate-spin" /> : <LogOut size={13} />}
      </button>
      <button
        onClick={handleDelete}
        disabled={loadingKey !== null}
        title="Delete user"
        className="rounded-lg p-1.5 disabled:opacity-50"
        style={{ background: "hsl(0 84% 65% / 0.12)", color: "hsl(0 84% 55%)" }}
      >
        {loadingKey === "delete" ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );
}
