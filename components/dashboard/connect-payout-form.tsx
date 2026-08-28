"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { connectPayoutAccount, disconnectPayoutAccount, refreshPayoutVerification } from "@/lib/actions/store";

// A short, common Nigerian bank list keeps this usable without needing a
// live "list banks" API call for every provider on every page load. Codes
// match both Paystack's and Flutterwave's bank code schemes for these banks.
const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "UBA", code: "033" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Opay", code: "999992" },
  { name: "Moniepoint", code: "50515" },
  { name: "Palmpay", code: "999991" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "Stanbic IBTC", code: "221" },
];

type Provider = "PAYSTACK" | "FLUTTERWAVE";

export function ConnectPayoutForm({
  slug,
  provider,
  connected,
  details,
  commissionRate,
  verifiedAt,
  connectedAt,
}: {
  slug: string;
  provider: Provider;
  connected: boolean;
  details: { bankName?: string; accountName?: string; maskedAccountNumber?: string } | null;
  commissionRate: number;
  verifiedAt?: Date | null;
  connectedAt?: Date | null;
}) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const label = provider === "PAYSTACK" ? "Paystack" : "Flutterwave";

  async function handleConnect() {
    const bank = BANKS.find((b) => b.code === bankCode);
    if (!bank) return toast.error("Select your bank.");
    if (!/^\d{10}$/.test(accountNumber)) return toast.error("Enter a valid 10-digit account number.");

    setSaving(true);
    const result = await connectPayoutAccount(slug, { provider, bankCode, bankName: bank.name, accountNumber });
    setSaving(false);

    if (!result.success) return toast.error(result.error);
    toast.success(`${label} connected — payouts for your sales now go straight to this account.`);
    router.refresh();
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect your ${label} payout account? New sales will stop splitting to it.`)) return;
    setSaving(true);
    const result = await disconnectPayoutAccount(slug, provider);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${label} disconnected.`);
    router.refresh();
  }

  async function handleCheckVerification() {
    setChecking(true);
    const result = await refreshPayoutVerification(slug);
    setChecking(false);
    if (!result.success) return toast.error(result.error);
    if (result.data.verified) {
      toast.success("Verified! Your payouts are no longer held.");
    } else {
      toast("Still pending — Paystack hasn't finished reviewing this account yet.");
    }
    router.refresh();
  }

  if (connected) {
    const isVerified = Boolean(verifiedAt);
    return (
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">{label}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isVerified ? "Connected · Verified" : "Connected · Pending verification"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {details?.accountName} · {details?.bankName} · {details?.maskedAccountNumber}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You keep {(100 - commissionRate).toFixed(1)}% of each sale — it settles to this account automatically.
        </p>
        {!isVerified && provider === "PAYSTACK" && (
          <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            Paystack manually reviews new payout accounts. Your first payout will be held until verification
            completes — this usually doesn't affect checkout, just when the money actually lands.
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          {!isVerified && provider === "PAYSTACK" && (
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check verification status"}
            </button>
          )}
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">{label}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not connected</span>
      </div>
      <div className="space-y-2">
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Select your bank…</option>
          {BANKS.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
        <input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit account number"
          inputMode="numeric"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button
          onClick={handleConnect}
          disabled={saving}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Verifying…" : `Connect ${label}`}
        </button>
        <p className="text-xs text-muted-foreground">We verify the account name with {label} before saving — no typos slipping through.</p>
      </div>
    </div>
  );
}
