"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeOwnGatewayKeys, saveOwnGatewayKeys, setOwnGatewayActive, type OwnGatewaySettings } from "@/lib/actions/store-gateway";

type Provider = "PAYSTACK" | "FLUTTERWAVE";

const LABEL: Record<Provider, string> = { PAYSTACK: "Paystack", FLUTTERWAVE: "Flutterwave" };

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => toast.success("Copied"),
              () => toast.error("Couldn't copy — select and copy it manually.")
            );
          }}
          className="shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

function ProviderPanel({
  slug,
  provider,
  settings,
}: {
  slug: string;
  provider: Provider;
  settings: OwnGatewaySettings;
}) {
  const router = useRouter();
  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);

  const info = provider === "PAYSTACK" ? settings.paystack : settings.flutterwave;
  const isActive = settings.enabled && settings.provider === provider;
  const webhookUrl = provider === "PAYSTACK" ? settings.webhookUrls.paystack : settings.webhookUrls.flutterwave;

  async function handleSave() {
    if (!secretKey.trim()) return toast.error("Enter your secret key.");
    setBusy(true);
    const result = await saveOwnGatewayKeys(slug, { provider, secretKey, publicKey });
    setBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${LABEL[provider]} connected — customers now pay into your ${LABEL[provider]} account.`);
    setSecretKey("");
    setPublicKey("");
    router.refresh();
  }

  async function handleActivate() {
    setBusy(true);
    const result = await setOwnGatewayActive(slug, { enabled: true, provider });
    setBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Customers now pay into your ${LABEL[provider]} account.`);
    router.refresh();
  }

  async function handleRemove() {
    if (
      !confirm(
        `Remove your ${LABEL[provider]} keys? Customers will stop paying into your ${LABEL[provider]} account, and you won't be able to refund earlier ${LABEL[provider]} payments from BizNest until you add the keys again.`
      )
    )
      return;
    setBusy(true);
    const result = await removeOwnGatewayKeys(slug, provider);
    setBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`${LABEL[provider]} keys removed.`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium">{LABEL[provider]}</p>
        {info.saved ? (
          <span className="rounded-full bg-[var(--bn-admin-surface-2)] px-2 py-0.5 text-xs text-[var(--bn-admin-orange)]">
            {isActive ? "In use" : "Keys saved"}
            {info.mode === "test" ? " · Test mode" : ""}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not connected</span>
        )}
      </div>

      {info.saved && (
        <div className="mb-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Secret key {info.secretMasked}
            {info.publicKey ? ` · Public key ${info.publicKey.slice(0, 8)}••••${info.publicKey.slice(-4)}` : " · No public key (customers are sent to the hosted payment page)"}
          </p>
          {info.mode === "test" && (
            <p className="rounded-md bg-[var(--bn-admin-orange-soft)] p-2 text-xs text-[var(--bn-admin-orange)]">
              These are test keys. Orders will be marked paid for test payments, so switch to your live keys before taking real orders.
            </p>
          )}
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium">Webhook (recommended)</p>
            <p className="text-xs text-muted-foreground">
              {provider === "PAYSTACK"
                ? "In your Paystack dashboard go to Settings → API Keys & Webhooks and set this as your Webhook URL. It confirms payments even if a customer closes their browser early."
                : "In your Flutterwave dashboard go to Settings → Webhooks, set this URL, and paste the secret hash below into the “Secret hash” field. It confirms payments even if a customer closes their browser early."}
            </p>
            <CopyField label="Webhook URL" value={webhookUrl} />
            {provider === "FLUTTERWAVE" && settings.flutterwave.secretHash && (
              <CopyField label="Secret hash" value={settings.flutterwave.secretHash} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isActive && (
              <button
                type="button"
                onClick={handleActivate}
                disabled={busy}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Use this for customer payments
              </button>
            )}
            <button type="button" onClick={handleRemove} disabled={busy} className="text-xs font-medium text-destructive hover:underline disabled:opacity-50">
              Remove keys
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium">{info.saved ? "Replace keys" : "Add your keys"}</p>
        <input
          type="password"
          autoComplete="off"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={provider === "PAYSTACK" ? "Secret key (sk_live_…)" : "Secret key (FLWSECK-…)"}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          autoComplete="off"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          placeholder={provider === "PAYSTACK" ? "Public key (pk_live_…) — enables in-page card checkout" : "Public key (FLWPUBK-…) — enables in-page card checkout"}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Verifying…" : info.saved ? `Update ${LABEL[provider]} keys` : `Connect ${LABEL[provider]}`}
        </button>
        <p className="text-xs text-muted-foreground">
          We check the key with {LABEL[provider]} before saving and store it encrypted. Find it in your {LABEL[provider]} dashboard under Settings → API Keys.
        </p>
      </div>
    </div>
  );
}

export function OwnGatewayForm({ slug, settings }: { slug: string; settings: OwnGatewaySettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pauseOwnGateway() {
    setBusy(true);
    const result = await setOwnGatewayActive(slug, { enabled: false });
    setBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Customer payments now use the BizNest payout flow.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {settings.enabled && settings.provider ? (
        <div className="rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-4 text-sm text-[var(--bn-admin-orange)]">
          <p className="font-semibold">Customers are paying into your own {LABEL[settings.provider]} account</p>
          <p className="mt-1 text-xs leading-5">
            Orders, invoices, quote deposits, bookings and reservations are charged with your {LABEL[settings.provider]} keys, so the money goes straight to you and
            settles on your gateway&apos;s schedule. Gateway fees are charged by {LABEL[settings.provider]} to your account. Customer wallet top-ups still go through BizNest.
          </p>
          <button type="button" onClick={pauseOwnGateway} disabled={busy} className="mt-2 text-xs font-medium underline disabled:opacity-50">
            Switch back to BizNest payouts
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Prefer to collect payments in your own gateway account? Add your Paystack or Flutterwave keys and customers will pay you directly. Leave this empty to
          keep using the BizNest payout account above.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ProviderPanel slug={slug} provider="PAYSTACK" settings={settings} />
        <ProviderPanel slug={slug} provider="FLUTTERWAVE" settings={settings} />
      </div>
    </div>
  );
}
