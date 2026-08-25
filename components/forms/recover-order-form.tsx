"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOrderRecovery, confirmOrderRecovery } from "@/lib/actions/order-recovery";
import { toast } from "sonner";
import { Mail, KeyRound } from "lucide-react";

export function RecoverOrderForm({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(0);

  async function handleRequestCode() {
    if (!email.trim()) return;
    setIsSubmitting(true);
    const result = await requestOrderRecovery(storeSlug, email);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("If that email has any orders here, a code is on its way to it.");
    setStep("code");
  }

  async function handleConfirmCode() {
    if (!code.trim()) return;
    setIsSubmitting(true);
    const result = await confirmOrderRecovery(storeSlug, email, code);
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setRecoveredCount(result.data.recoveredCount);
    setStep("done");
    router.refresh();
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <p className="font-semibold text-emerald-900">
          {recoveredCount} order{recoveredCount === 1 ? "" : "s"} recovered
        </p>
        <p className="mt-1 text-sm text-emerald-700">They&apos;re now in your order history.</p>
        <a
          href={`/store/${storeSlug}/orders`}
          className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          View my orders
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-semibold text-slate-900">Recover a lost order</p>
      <p className="mt-1 text-sm text-slate-500">
        If you placed an order at {storeName} but it isn&apos;t showing up here — for example after getting
        logged out mid-checkout — enter the email of the account you were signed into at the time, and
        we&apos;ll send a code to move it into this account.
      </p>

      {step === "email" ? (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <Mail className="h-4 w-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRequestCode()}
              placeholder="Email of that account"
              className="flex-1 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleRequestCode}
            disabled={isSubmitting || !email.trim()}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send code
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCode()}
              placeholder="6-digit code"
              className="flex-1 text-sm tracking-widest outline-none"
              maxLength={6}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmCode}
              disabled={isSubmitting || !code.trim()}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm and recover
            </button>
            <button
              onClick={() => setStep("email")}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
