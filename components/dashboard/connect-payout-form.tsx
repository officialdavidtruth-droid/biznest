"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { connectPayoutAccount, disconnectPayoutAccount } from "@/lib/actions/store";

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
}: {
  slug: string;
  provider: Provider;
  connected: boolean;
  details: { bankName?: string; accountName?: string; maskedAccountNumber?: string } | null;
  commissionRate: number;
}) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (connected) {
    return (
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">{label}</p>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Connected</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {details?.accountName} · {details?.bankName} · {details?.maskedAccountNumber}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You keep {(100 - commissionRate).toFixed(1)}% of each sale — it settles to this account automatically.
        </p>
        <button
          onClick={handleDisconnect}
          disabled={saving}
          className="mt-3 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
        >
          Disconnect
        </button>
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
