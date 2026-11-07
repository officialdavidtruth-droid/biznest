"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { connectPayoutAccount, disconnectPayoutAccount, listPayoutBanks, lookupPayoutAccountName } from "@/lib/actions/store";

// Fallback only, used if the gateway's live bank list can't be loaded. Codes
// are the same on every gateway for the big banks, but NOT for Opay/Palmpay,
// so those two are left out of the fallback.
const FALLBACK_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "UBA", code: "033" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint", code: "50515" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "Stanbic IBTC", code: "221" },
];

type Provider = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

export function ConnectPayoutForm({
  slug,
  provider,
  connected,
  needsReconnect = false,
  details,
}: {
  slug: string;
  /** Gateway used to verify the account name when connecting. */
  provider: Provider;
  connected: boolean;
  /** Connected under the old subaccount model -- must re-enter bank details. */
  needsReconnect?: boolean;
  details: { bankName?: string; accountName?: string; maskedAccountNumber?: string } | null;
}) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>(FALLBACK_BANKS);
  const [bankQuery, setBankQuery] = useState("");
  // Account holder name, looked up as soon as a bank is picked and 10 digits are typed.
  const [lookup, setLookup] = useState<{ state: "idle" | "checking" | "found" | "error"; name?: string; error?: string }>({ state: "idle" });

  useEffect(() => {
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      setLookup({ state: "idle" });
      return;
    }
    let cancelled = false;
    setLookup({ state: "checking" });
    const t = window.setTimeout(() => {
      lookupPayoutAccountName(slug, { provider, bankCode, accountNumber }).then((res) => {
        if (cancelled) return;
        setLookup(res.success ? { state: "found", name: res.data.accountName } : { state: "error", error: res.error });
      });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [slug, provider, bankCode, accountNumber]);

  // Load the verifying gateway's own bank list so every code is one it accepts.
  useEffect(() => {
    let cancelled = false;
    listPayoutBanks(provider).then((res) => {
      if (!cancelled && res.success) setBanks(res.data);
    });
    return () => { cancelled = true; };
  }, [provider]);

  async function handleConnect() {
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) return toast.error("Select your bank.");
    if (!/^\d{10}$/.test(accountNumber)) return toast.error("Enter a valid 10-digit account number.");
    if (lookup.state !== "found") return toast.error("Wait for your account name to appear, then connect.");

    setSaving(true);
    const result = await connectPayoutAccount(slug, { provider, bankCode, bankName: bank.name, accountNumber });
    setSaving(false);

    if (!result.success) return toast.error(result.error);
    toast.success("Bank account connected — your sales are paid out to this account.");
    setBankCode("");
    setAccountNumber("");
    setLookup({ state: "idle" });
    router.refresh();
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your payout account? We won't be able to pay out new sales until you connect one again.")) return;
    setSaving(true);
    const result = await disconnectPayoutAccount(slug);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Payout account disconnected.");
    router.refresh();
  }

  if (connected) {
    return (
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">Bank account</p>
          <span className="rounded-full bg-[var(--bn-admin-surface-2)] px-2 py-0.5 text-xs text-[var(--bn-admin-orange)]">
            Connected
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {details?.accountName} · {details?.bankName} · {details?.maskedAccountNumber}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Each sale is sent to this account once the customer&apos;s payment is confirmed. Customers pay the processing fee, so you receive the full price.
        </p>
        <div className="mt-3 flex items-center gap-3">
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
        <p className="font-medium">Bank account</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not connected</span>
      </div>
      {needsReconnect && (
        <p className="mb-3 rounded-md bg-[var(--bn-admin-orange-soft)] p-2 text-xs text-[var(--bn-admin-orange)]">
          We&apos;ve changed how payouts work. Re-enter your bank details once to keep receiving your money
          {details?.bankName ? ` (previously ${details.bankName} ${details.maskedAccountNumber ?? ""})` : ""}.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="payout-bank">Bank</label>
          {banks.length > 12 && (
            <input
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder="Search your bank (e.g. OPay, GTBank)"
              className="mb-2 w-full rounded-md border px-3 py-2 text-sm"
            />
          )}
          <select id="payout-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Select your bank…</option>
            {banks
              .filter((b) => !bankQuery.trim() || b.name.toLowerCase().includes(bankQuery.trim().toLowerCase()) || b.code === bankCode)
              .map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="payout-number">Account number</label>
          <input
            id="payout-number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit account number"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div aria-live="polite" className="min-h-[2.5rem] rounded-md bg-muted/50 px-3 py-2 text-sm">
          {lookup.state === "idle" && <span className="text-muted-foreground">Your account name will appear here.</span>}
          {lookup.state === "checking" && <span className="text-muted-foreground">Checking with your bank…</span>}
          {lookup.state === "found" && <span><span className="text-muted-foreground">Account name: </span><span className="font-semibold">{lookup.name}</span></span>}
          {lookup.state === "error" && <span className="text-destructive">{lookup.error}</span>}
        </div>
        <button
          onClick={handleConnect}
          disabled={saving || lookup.state !== "found"}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Connecting…" : "Connect bank account"}
        </button>
        <p className="text-xs text-muted-foreground">Check the name is yours before connecting. Your sales are paid into this account.</p>
      </div>
    </div>
  );
}
